import React, { useState, useEffect, useMemo } from 'react';
import { Goal, KeyResult, Project, User } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  GoalsIcon, 
  PlusIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  UsersIcon, 
  FilterIcon, 
  SearchIcon, 
  XIcon, 
  ChevronRightIcon, 
  StarIcon 
} from './icons';

interface GoalsPageProps {
  currentUser?: User | null;
  users?: User[];
  projects?: Project[];
}

export const GoalsPage: React.FC<GoalsPageProps> = ({
  currentUser,
  users = [],
  projects = [],
}) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<string>('Q1 2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New goal form state
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('2025-06-30');
  const [newKeyResults, setNewKeyResults] = useState<Array<{ name: string; target: number; unit: string }>>([
    { name: 'Deliver Enterprise Milestone 1', target: 100, unit: '%' }
  ]);

  useEffect(() => {
    const loadGoals = async () => {
      setLoading(true);
      try {
        const goalList = await enhancedApi.getGoals();
        if (goalList.length === 0) {
          const defaultGoals: Goal[] = [
            {
              id: 'goal-1',
              name: 'Achieve Seamless Operational Flow & Zero Unresolved Blockers',
              description: 'Eliminate chronic workflow impediments, stabilize cycle times, and meet all customer SLAs.',
              ownerId: currentUser?.uid || 'user-1',
              targetDate: new Date('2025-06-30'),
              status: 'in_progress',
              progress: 68,
              keyResults: [
                { id: 'kr-1', name: 'Reduce average cycle time to ≤ 3.0 days', targetValue: 3, currentValue: 2.8, unit: 'days', isCompleted: true },
                { id: 'kr-2', name: 'Maintain 90%+ SLA predictability', targetValue: 90, currentValue: 88, unit: '%', isCompleted: false },
                { id: 'kr-3', name: 'Resolve critical path blockers within 24 hours', targetValue: 100, currentValue: 80, unit: '%', isCompleted: false },
              ],
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'goal-2',
              name: 'Expand Franchise & Retail Technology Footprint',
              description: 'Deploy the new retail ERP integration and self-checkout point-of-sale across 15 store locations.',
              ownerId: 'user-2',
              targetDate: new Date('2025-09-30'),
              status: 'in_progress',
              progress: 45,
              keyResults: [
                { id: 'kr-4', name: 'Rollout POS software to all 15 stores', targetValue: 15, currentValue: 7, unit: 'stores', isCompleted: false },
                { id: 'kr-5', name: 'Train store managers and cashiers', targetValue: 100, currentValue: 60, unit: '%', isCompleted: false },
              ],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ];
          setGoals(defaultGoals);
        } else {
          setGoals(goalList);
        }
      } catch (err) {
        console.error('Failed to load goals', err);
      } finally {
        setLoading(false);
      }
    };
    loadGoals();
  }, [currentUser]);

  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.uid, u));
    return map;
  }, [users]);

  const handleUpdateKeyResult = (goalId: string, krId: string, newValue: number) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      const updatedKrs = g.keyResults.map(kr => {
        if (kr.id !== krId) return kr;
        const isDone = newValue >= kr.targetValue;
        return { ...kr, currentValue: newValue, isCompleted: isDone };
      });
      // Recalculate goal progress
      const totalKrProgress = updatedKrs.reduce((sum, kr) => {
        const pct = Math.min(100, Math.round((kr.currentValue / (kr.targetValue || 1)) * 100));
        return sum + pct;
      }, 0);
      const newProgress = Math.round(totalKrProgress / updatedKrs.length);

      return {
        ...g,
        keyResults: updatedKrs,
        progress: newProgress,
        status: newProgress >= 100 ? 'completed' : 'in_progress',
        updatedAt: new Date(),
      };
    }));
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;

    const formattedKrs: KeyResult[] = newKeyResults.map((kr, idx) => ({
      id: `kr-${Date.now()}-${idx}`,
      name: kr.name,
      targetValue: kr.target,
      currentValue: 0,
      unit: kr.unit,
      isCompleted: false,
    }));

    try {
      const created = await enhancedApi.createGoal({
        name: newGoalName,
        description: newGoalDesc,
        ownerId: currentUser?.uid || 'user-1',
        targetDate: new Date(newGoalTargetDate),
        keyResults: formattedKrs,
      });

      setGoals([created, ...goals]);
      setIsCreateModalOpen(false);
      setNewGoalName('');
      setNewGoalDesc('');
      setNewKeyResults([{ name: 'Deliver Enterprise Milestone 1', target: 100, unit: '%' }]);
    } catch (err) {
      console.error('Failed to create goal', err);
    }
  };

  const filteredGoals = goals.filter(g => {
    return g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (g.description || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between flex-wrap gap-4 sticky top-0 z-20 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
              <GoalsIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-gray-900">Objectives & Key Results (OKRs)</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Align team priorities with corporate objectives, set measurable targets, and track quarterly performance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedCycle}
            onChange={e => setSelectedCycle(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl font-bold text-gray-700"
          >
            <option value="Q1 2025">Q1 2025 (Jan - Mar)</option>
            <option value="Q2 2025">Q2 2025 (Apr - Jun)</option>
            <option value="Q3 2025">Q3 2025 (Jul - Sep)</option>
            <option value="Annual 2025">Annual 2025</option>
          </select>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Objective</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Search Bar */}
        <div className="flex items-center space-x-2 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm max-w-md">
          <SearchIcon className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search objectives or key results..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="text-xs text-gray-800 bg-transparent border-none outline-none focus:ring-0 w-full"
          />
        </div>

        {/* Goals List */}
        <div className="space-y-6">
          {filteredGoals.map(goal => {
            const owner = usersMap.get(goal.ownerId);

            return (
              <div
                key={goal.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5"
              >
                {/* Goal Top Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        goal.progress >= 70 ? 'bg-emerald-100 text-emerald-800' :
                        goal.progress >= 40 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {goal.progress >= 100 ? 'Completed' : goal.progress >= 70 ? 'On Track' : 'In Progress'}
                      </span>
                      <span className="text-xs text-gray-400">Target Date: {new Date(goal.targetDate).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">{goal.name}</h3>
                    {goal.description && <p className="text-xs text-gray-500">{goal.description}</p>}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-blue-600">{goal.progress}%</div>
                    <span className="text-[11px] text-gray-400 font-medium">Objective Progress</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${goal.progress}%` }}
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  />
                </div>

                {/* Key Results Tracker */}
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Key Results ({goal.keyResults.length})
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goal.keyResults.map(kr => {
                      const krPct = Math.min(100, Math.round((kr.currentValue / (kr.targetValue || 1)) * 100));

                      return (
                        <div
                          key={kr.id}
                          className="p-3.5 rounded-xl bg-slate-50 border border-gray-100 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-800 truncate flex-1 pr-2">{kr.name}</span>
                            <span className="font-bold text-gray-900 shrink-0">
                              {kr.currentValue} / {kr.targetValue} {kr.unit} ({krPct}%)
                            </span>
                          </div>

                          {/* Interactive Slider to update key result */}
                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              min="0"
                              max={kr.targetValue}
                              step={kr.targetValue > 20 ? 1 : 0.1}
                              value={kr.currentValue}
                              onChange={e => handleUpdateKeyResult(goal.id, kr.id, parseFloat(e.target.value))}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            {kr.isCompleted && (
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                  <span>Owner: <strong>{owner?.displayName || 'Executive Leader'}</strong></span>
                  <span>Cycle: <strong>{selectedCycle}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE GOAL MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">New Strategic Objective (OKR)</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Objective Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Increase product adoption by 40%"
                  value={newGoalName}
                  onChange={e => setNewGoalName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Why is this objective critical this quarter?"
                  value={newGoalDesc}
                  onChange={e => setNewGoalDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Target Date</label>
                <input
                  type="date"
                  value={newGoalTargetDate}
                  onChange={e => setNewGoalTargetDate(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Key Results Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Key Results</label>
                  <button
                    type="button"
                    onClick={() => setNewKeyResults([...newKeyResults, { name: 'New Key Result', target: 100, unit: '%' }])}
                    className="text-xs text-blue-600 font-bold hover:text-blue-800"
                  >
                    + Add Key Result
                  </button>
                </div>

                <div className="space-y-2">
                  {newKeyResults.map((kr, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Key result name"
                        value={kr.name}
                        onChange={e => {
                          const updated = [...newKeyResults];
                          updated[idx].name = e.target.value;
                          setNewKeyResults(updated);
                        }}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="number"
                        placeholder="Target"
                        value={kr.target}
                        onChange={e => {
                          const updated = [...newKeyResults];
                          updated[idx].target = parseFloat(e.target.value) || 0;
                          setNewKeyResults(updated);
                        }}
                        className="w-20 text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={kr.unit}
                        onChange={e => {
                          const updated = [...newKeyResults];
                          updated[idx].unit = e.target.value;
                          setNewKeyResults(updated);
                        }}
                        className="w-16 text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Save Objective
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;
