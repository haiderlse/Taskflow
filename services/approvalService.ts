import { 
  ApprovalRequest, 
  ApprovalHierarchy, 
  ApprovalRule, 
  Task, 
  User, 
  Approval 
} from '../types';
import { enhancedApi } from './enhancedApi';

export class ApprovalService {
  private static approvalHierarchies: ApprovalHierarchy[] = [
    {
      id: 'hierarchy-1',
      name: 'Standard Task Approval',
      description: 'Default approval hierarchy for tasks',
      rules: [
        {
          id: 'rule-1',
          condition: {
            field: 'priority',
            operator: 'equals',
            value: 'critical'
          },
          approvers: [
            { type: 'manager', identifier: 'requester_manager', isRequired: true, order: 1 },
            { type: 'role', identifier: 'admin', isRequired: true, order: 2 }
          ],
          escalationTimeHours: 4
        },
        {
          id: 'rule-2',
          condition: {
            field: 'priority',
            operator: 'equals',
            value: 'high'
          },
          approvers: [
            { type: 'manager', identifier: 'requester_manager', isRequired: true, order: 1 }
          ],
          escalationTimeHours: 8
        },
        {
          id: 'rule-3',
          condition: {
            field: 'estimatedValue',
            operator: 'greater_than',
            value: 10000
          },
          approvers: [
            { type: 'manager', identifier: 'requester_manager', isRequired: true, order: 1 },
            { type: 'role', identifier: 'admin', isRequired: true, order: 2 }
          ],
          escalationTimeHours: 12
        }
      ],
      isActive: true,
      createdBy: 'user-1',
      createdAt: new Date()
    }
  ];

  static async createApprovalRequest(
    taskId: string,
    requestedBy: string,
    description?: string,
    estimatedValue?: number
  ): Promise<ApprovalRequest> {
    try {
      const task = await enhancedApi.getTaskById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const users = await enhancedApi.getUsers();
      const requester = users.find(u => u.uid === requestedBy);
      if (!requester) {
        throw new Error('Requester not found');
      }

      // Determine appropriate approval hierarchy
      const hierarchy = this.approvalHierarchies.find(h => h.isActive);
      if (!hierarchy) {
        throw new Error('No active approval hierarchy found');
      }

      // Find matching rule
      const matchingRule = this.findMatchingRule(hierarchy, task, estimatedValue);
      if (!matchingRule) {
        // No approval required
        return null;
      }

      // Resolve approvers based on rule
      const approvers = await this.resolveApprovers(matchingRule.approvers, requester, users);
      
      const approvalRequest: ApprovalRequest = {
        id: `approval-${Date.now()}`,
        taskId,
        requestedBy,
        approvers: approvers.map(a => a.uid),
        status: 'pending',
        description,
        approvals: [],
        createdAt: new Date(),
        dueDate: new Date(Date.now() + (matchingRule.escalationTimeHours || 24) * 60 * 60 * 1000),
        approvalType: this.getApprovalType(matchingRule),
        requiredApprovals: this.getRequiredApprovals(matchingRule),
        escalationPath: await this.buildEscalationPath(requester, users),
        estimatedValue,
        priority: task.priority,
        currentApproverIndex: 0
      };

      // Update task with approval request
      await enhancedApi.updateTask(taskId, { approval: approvalRequest });

      // Send notifications (in a real app, this would send emails/notifications)
      this.sendApprovalNotifications(approvalRequest, approvers);

      return approvalRequest;
    } catch (error) {
      throw new Error(`Failed to create approval request: ${error.message}`);
    }
  }

  static async submitApproval(
    approvalId: string,
    userId: string,
    status: 'approved' | 'rejected',
    comment?: string
  ): Promise<ApprovalRequest> {
    try {
      // Find task with this approval
      const tasks = await enhancedApi.getTasks();
      const task = tasks.find(t => t.approval?.id === approvalId);
      
      if (!task || !task.approval) {
        throw new Error('Approval request not found');
      }

      const approvalRequest = task.approval;
      
      if (approvalRequest.status !== 'pending') {
        throw new Error('Approval request is no longer pending');
      }

      if (!approvalRequest.approvers.includes(userId)) {
        throw new Error('User is not authorized to approve this request');
      }

      // Check if user has already approved
      const existingApproval = approvalRequest.approvals.find(a => a.userId === userId);
      if (existingApproval) {
        throw new Error('User has already provided approval');
      }

      // Add approval
      const approval: Approval = {
        userId,
        status,
        comment,
        timestamp: new Date(),
        signatureHash: this.generateSignatureHash(userId, status, approvalRequest.id)
      };

      approvalRequest.approvals.push(approval);

      // Check if approval is complete
      const finalStatus = this.calculateApprovalStatus(approvalRequest);
      approvalRequest.status = finalStatus;

      // Update current approver index for sequential approvals
      if (approvalRequest.approvalType === 'sequential' && finalStatus === 'pending') {
        approvalRequest.currentApproverIndex = (approvalRequest.currentApproverIndex || 0) + 1;
      }

      // Update task
      await enhancedApi.updateTask(task.id, { approval: approvalRequest });

      // Handle post-approval actions
      if (finalStatus === 'approved') {
        await this.handleApprovalComplete(task, approvalRequest);
      } else if (finalStatus === 'rejected') {
        await this.handleApprovalRejected(task, approvalRequest);
      }

      return approvalRequest;
    } catch (error) {
      throw new Error(`Failed to submit approval: ${error.message}`);
    }
  }

  static async getApprovalRequestsForUser(userId: string): Promise<ApprovalRequest[]> {
    const tasks = await enhancedApi.getTasks();
    return tasks
      .filter(task => 
        task.approval && 
        task.approval.status === 'pending' &&
        task.approval.approvers.includes(userId) &&
        !task.approval.approvals.some(a => a.userId === userId)
      )
      .map(task => task.approval)
      .filter(approval => approval !== null) as ApprovalRequest[];
  }

  static async getApprovalHistory(taskId: string): Promise<ApprovalRequest | null> {
    const task = await enhancedApi.getTaskById(taskId);
    return task?.approval || null;
  }

  private static findMatchingRule(
    hierarchy: ApprovalHierarchy,
    task: Task,
    estimatedValue?: number
  ): ApprovalRule | null {
    for (const rule of hierarchy.rules) {
      if (this.evaluateCondition(rule.condition, task, estimatedValue)) {
        return rule;
      }
    }
    return null;
  }

  private static evaluateCondition(
    condition: any,
    task: Task,
    estimatedValue?: number
  ): boolean {
    const { field, operator, value } = condition;
    
    let fieldValue: any;
    switch (field) {
      case 'priority':
        fieldValue = task.priority;
        break;
      case 'estimatedValue':
        fieldValue = estimatedValue || 0;
        break;
      case 'taskType':
        fieldValue = task.tags.join(',');
        break;
      case 'projectId':
        fieldValue = task.projectId;
        break;
      default:
        return false;
    }

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'contains':
        return fieldValue.toString().toLowerCase().includes(value.toLowerCase());
      default:
        return false;
    }
  }

  private static async resolveApprovers(
    approverConfigs: any[],
    requester: User,
    allUsers: User[]
  ): Promise<User[]> {
    const approvers: User[] = [];

    for (const config of approverConfigs) {
      switch (config.type) {
        case 'user':
          const user = allUsers.find(u => u.uid === config.identifier);
          if (user) approvers.push(user);
          break;
        
        case 'role':
          const roleUsers = allUsers.filter(u => u.role === config.identifier);
          approvers.push(...roleUsers);
          break;
        
        case 'manager':
          if (requester.managerId) {
            const manager = allUsers.find(u => u.uid === requester.managerId);
            if (manager) approvers.push(manager);
          }
          break;
        
        case 'department_head':
          const deptHead = allUsers.find(u => 
            u.department === requester.department && u.role === 'manager'
          );
          if (deptHead) approvers.push(deptHead);
          break;
      }
    }

    // Remove duplicates and requester
    return approvers.filter((user, index, self) => 
      user.uid !== requester.uid &&
      self.findIndex(u => u.uid === user.uid) === index
    );
  }

  private static getApprovalType(rule: ApprovalRule): 'sequential' | 'parallel' | 'any_one' {
    const hasOrder = rule.approvers.some(a => a.order !== undefined);
    const allRequired = rule.approvers.every(a => a.isRequired);
    
    if (hasOrder) return 'sequential';
    if (allRequired) return 'parallel';
    return 'any_one';
  }

  private static getRequiredApprovals(rule: ApprovalRule): number {
    const requiredCount = rule.approvers.filter(a => a.isRequired).length;
    return requiredCount > 0 ? requiredCount : 1;
  }

  private static async buildEscalationPath(requester: User, allUsers: User[]): Promise<string[]> {
    const path: string[] = [];
    
    // Add manager
    if (requester.managerId) {
      path.push(requester.managerId);
    }
    
    // Add department head if different from manager
    const deptHead = allUsers.find(u => 
      u.department === requester.department && u.role === 'manager'
    );
    if (deptHead && !path.includes(deptHead.uid)) {
      path.push(deptHead.uid);
    }
    
    // Add admin users
    const admins = allUsers.filter(u => u.role === 'admin');
    admins.forEach(admin => {
      if (!path.includes(admin.uid)) {
        path.push(admin.uid);
      }
    });
    
    return path;
  }

  private static calculateApprovalStatus(request: ApprovalRequest): 'pending' | 'approved' | 'rejected' {
    const rejections = request.approvals.filter(a => a.status === 'rejected');
    if (rejections.length > 0) {
      return 'rejected';
    }

    const approvals = request.approvals.filter(a => a.status === 'approved');
    
    switch (request.approvalType) {
      case 'any_one':
        return approvals.length > 0 ? 'approved' : 'pending';
      
      case 'parallel':
        return approvals.length >= request.requiredApprovals ? 'approved' : 'pending';
      
      case 'sequential':
        // Check if all required approvals are received in order
        const sortedApprovers = [...request.approvers];
        const approvedInOrder = approvals.length >= request.requiredApprovals;
        return approvedInOrder ? 'approved' : 'pending';
      
      default:
        return 'pending';
    }
  }

  private static generateSignatureHash(userId: string, status: string, approvalId: string): string {
    const data = `${userId}-${status}-${approvalId}-${Date.now()}`;
    return btoa(data).split('').reverse().join('');
  }

  private static sendApprovalNotifications(request: ApprovalRequest, approvers: User[]): void {
    // In a real application, send email/push notifications
    console.log(`Approval request ${request.id} sent to:`, approvers.map(a => a.email));
  }

  private static async handleApprovalComplete(task: Task, approval: ApprovalRequest): Promise<void> {
    // Auto-start task or other post-approval actions
    await enhancedApi.updateTask(task.id, { 
      taskStatus: 'in_progress',
      startDate: new Date()
    });
    console.log(`Task ${task.id} approved and started`);
  }

  private static async handleApprovalRejected(task: Task, approval: ApprovalRequest): Promise<void> {
    // Handle rejection - maybe notify requester or move to different status
    await enhancedApi.updateTask(task.id, { 
      taskStatus: 'on_hold'
    });
    console.log(`Task ${task.id} rejected and put on hold`);
  }

  // Public method to get approval hierarchies for management
  static getApprovalHierarchies(): ApprovalHierarchy[] {
    return this.approvalHierarchies;
  }

  static async createApprovalHierarchy(hierarchy: Partial<ApprovalHierarchy>): Promise<ApprovalHierarchy> {
    const newHierarchy: ApprovalHierarchy = {
      id: `hierarchy-${Date.now()}`,
      name: hierarchy.name || '',
      description: hierarchy.description,
      rules: hierarchy.rules || [],
      isActive: hierarchy.isActive ?? true,
      createdBy: hierarchy.createdBy || '',
      createdAt: new Date()
    };

    this.approvalHierarchies.push(newHierarchy);
    return newHierarchy;
  }
}