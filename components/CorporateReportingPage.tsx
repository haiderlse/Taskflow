import React, { useState, useEffect } from 'react';
import { User, ApprovalRequest } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { ApprovalService } from '../services/approvalService';
import { 
  ReportingIcon, 
  UsersIcon, 
  CheckCircleIcon, 
  XIcon, 
  ClockIcon,
  ChevronDownIcon 
} from './icons';

interface CorporateReportingPageProps {
  currentUser: User;
  users: User[];
}

interface ApprovalMetrics {
  totalRequests: number;
  approved: number;
  rejected: number;
  pending: number;
  averageResponseTime: number;
  approvalsByDepartment: { [key: string]: number };
  approvalsByUser: { [key: string]: number };
}

const CorporateReportingPage: React.FC<CorporateReportingPageProps> = ({ currentUser, users }) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'approvals' | 'users' | 'departments'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [metrics, setMetrics] = useState<ApprovalMetrics>({
    totalRequests: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    averageResponseTime: 0,
    approvalsByDepartment: {},
    approvalsByUser: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Simulate loading approval metrics
      // In a real application, this would fetch from an analytics API
      const mockMetrics: ApprovalMetrics = {
        totalRequests: 145,
        approved: 98,
        rejected: 12,
        pending: 35,
        averageResponseTime: 4.2, // hours
        approvalsByDepartment: {
          'Engineering': 45,
          'Marketing': 32,
          'Finance': 28,
          'Operations': 25,
          'HR': 15
        },
        approvalsByUser: users.reduce((acc, user) => {
          acc[user.displayName] = Math.floor(Math.random() * 20) + 5;
          return acc;
        }, {} as { [key: string]: number })
      };
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Requests"
          value={metrics.totalRequests}
          icon={<ReportingIcon className="w-8 h-8 text-blue-500" />}
          trend="+12% from last period"
          trendPositive={true}
        />
        <MetricCard
          title="Approved"
          value={metrics.approved}
          icon={<CheckCircleIcon className="w-8 h-8 text-green-500" />}
          trend="+8% from last period"
          trendPositive={true}
        />
        <MetricCard
          title="Pending"
          value={metrics.pending}
          icon={<ClockIcon className="w-8 h-8 text-yellow-500" />}
          trend="-5% from last period"
          trendPositive={true}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${metrics.averageResponseTime}h`}
          icon={<ClockIcon className="w-8 h-8 text-purple-500" />}
          trend="-15% from last period"
          trendPositive={true}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval Status Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Status Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-600">Approved</span>
              </div>
              <span className="text-sm font-medium">{((metrics.approved / metrics.totalRequests) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${(metrics.approved / metrics.totalRequests) * 100}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm text-gray-600">Rejected</span>
              </div>
              <span className="text-sm font-medium">{((metrics.rejected / metrics.totalRequests) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full" 
                style={{ width: `${(metrics.rejected / metrics.totalRequests) * 100}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm text-gray-600">Pending</span>
              </div>
              <span className="text-sm font-medium">{((metrics.pending / metrics.totalRequests) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full" 
                style={{ width: `${(metrics.pending / metrics.totalRequests) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Approvals by Department</h3>
          <div className="space-y-3">
            {Object.entries(metrics.approvalsByDepartment).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{dept}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(count / Math.max(...Object.values(metrics.approvalsByDepartment))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-600">Manage users, roles, and permissions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approvals Given
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      user.role === 'member' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.department || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {metrics.approvalsByUser[user.displayName] || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDepartmentsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(metrics.approvalsByDepartment).map(([dept, count]) => {
            const deptUsers = users.filter(u => u.department === dept);
            const deptManagers = deptUsers.filter(u => u.role === 'manager');
            
            return (
              <div key={dept} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{dept}</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Users: {deptUsers.length}</p>
                  <p>Managers: {deptManagers.length}</p>
                  <p>Approvals: {count}</p>
                  <p>Avg Response: {(Math.random() * 5 + 2).toFixed(1)}h</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizational Hierarchy</h3>
        <div className="space-y-4">
          {users.filter(u => u.role === 'admin').map(admin => (
            <div key={admin.uid} className="border-l-4 border-purple-500 pl-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {admin.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{admin.displayName}</p>
                  <p className="text-sm text-gray-500">Administrator</p>
                </div>
              </div>
              
              {users.filter(u => u.role === 'manager' && u.managerId === admin.uid).map(manager => (
                <div key={manager.uid} className="ml-8 border-l-4 border-blue-500 pl-4 mt-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {manager.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{manager.displayName}</p>
                      <p className="text-xs text-gray-500">Manager - {manager.department}</p>
                    </div>
                  </div>
                  
                  {users.filter(u => u.role === 'member' && u.managerId === manager.uid).map(member => (
                    <div key={member.uid} className="ml-6 mt-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                          {member.displayName.charAt(0)}
                        </div>
                        <p className="text-xs text-gray-700">{member.displayName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ReportingIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading corporate reporting data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Corporate Reporting</h1>
          <p className="mt-2 text-gray-600">
            Comprehensive analytics and insights for your organization.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'overview', label: 'Overview', icon: ReportingIcon },
              { key: 'approvals', label: 'Approvals', icon: CheckCircleIcon },
              { key: 'users', label: 'Users', icon: UsersIcon },
              { key: 'departments', label: 'Departments', icon: UsersIcon }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedTab(key as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedTab === key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Content */}
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'approvals' && renderOverviewTab()}
        {selectedTab === 'users' && renderUsersTab()}
        {selectedTab === 'departments' && renderDepartmentsTab()}
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  trendPositive: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, trendPositive }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className="flex-shrink-0">{icon}</div>
    </div>
    <div className="mt-4">
      <span className={`text-sm ${trendPositive ? 'text-green-600' : 'text-red-600'}`}>
        {trend}
      </span>
    </div>
  </div>
);

export default CorporateReportingPage;