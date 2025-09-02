import { useState, useEffect, useCallback } from 'react';

interface HealthCheckFailure {
  id: string;
  user_id: string;
  email: string;
  check_type: string;
  error_message: string;
  details: any;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

interface HealthCheckStats {
  failures: HealthCheckFailure[];
  total: number;
  unresolvedByType: Record<string, number>;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function HealthCheckMonitor() {
  const [stats, setStats] = useState<HealthCheckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    unresolved: true,
    checkType: '',
    email: ''
  });
  const [selectedFailures, setSelectedFailures] = useState<string[]>([]);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchFailures = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.unresolved) params.append('unresolved', 'true');
      if (filter.checkType) params.append('checkType', filter.checkType);
      if (filter.email) params.append('email', filter.email);
      
      const response = await fetch(`/api/admin/health-check-failures?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch health check failures:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchFailures();
  }, [filter]);

  const resolveFailures = async () => {
    if (selectedFailures.length === 0) return;
    
    try {
      const response = await fetch('/api/admin/health-check-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedFailures,
          resolution_notes: resolutionNotes || 'Manually resolved by admin'
        })
      });
      
      if (response.ok) {
        setSelectedFailures([]);
        setResolutionNotes('');
        fetchFailures();
      }
    } catch (error) {
      console.error('Failed to resolve failures:', error);
    }
  };

  const checkTypeColors: Record<string, string> = {
    'stripe_customer_creation': 'bg-red-100 text-red-800',
    'subscription_creation': 'bg-orange-100 text-orange-800',
    'cluster_assignment': 'bg-yellow-100 text-yellow-800',
    'hopsworks_user_creation': 'bg-blue-100 text-blue-800',
    'hopsworks_user_creation_team': 'bg-indigo-100 text-indigo-800',
    'hopsworks_user_creation_owner': 'bg-purple-100 text-purple-800',
    'maxnumprojects_update': 'bg-green-100 text-green-800',
    'team_cluster_mismatch': 'bg-pink-100 text-pink-800'
  };

  if (loading) {
    return <div className="p-4">Loading health check failures...</div>;
  }

  if (!stats) {
    return <div className="p-4">No data available</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-semibold mb-4">Health Check Failures Monitor</h2>
        
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-500">Total Failures</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          {Object.entries(stats.unresolvedByType).map(([type, count]) => (
            <div key={type} className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-500">{type.replace(/_/g, ' ')}</div>
              <div className="text-xl font-semibold">{count}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filter.unresolved}
              onChange={(e) => setFilter({ ...filter, unresolved: e.target.checked })}
              className="mr-2"
            />
            Unresolved Only
          </label>
          <input
            type="text"
            placeholder="Filter by email"
            value={filter.email}
            onChange={(e) => setFilter({ ...filter, email: e.target.value })}
            className="px-3 py-1 border rounded"
          />
          <select
            value={filter.checkType}
            onChange={(e) => setFilter({ ...filter, checkType: e.target.value })}
            className="px-3 py-1 border rounded"
          >
            <option value="">All Types</option>
            {Object.keys(stats.unresolvedByType).map(type => (
              <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedFailures.length > 0 && (
          <div className="bg-blue-50 p-3 rounded mb-4">
            <div className="flex items-center gap-4">
              <span>{selectedFailures.length} selected</span>
              <input
                type="text"
                placeholder="Resolution notes..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="flex-1 px-3 py-1 border rounded"
              />
              <button
                onClick={resolveFailures}
                className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        )}

        {/* Failures Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  <input
                    type="checkbox"
                    checked={selectedFailures.length === stats.failures.length && stats.failures.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFailures(stats.failures.map(f => f.id));
                      } else {
                        setSelectedFailures([]);
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Check Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Error</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.failures.map((failure) => (
                <tr key={failure.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedFailures.includes(failure.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFailures([...selectedFailures, failure.id]);
                        } else {
                          setSelectedFailures(selectedFailures.filter(id => id !== failure.id));
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {new Date(failure.created_at).toLocaleDateString()} {new Date(failure.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 text-sm">{failure.email}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 text-xs rounded ${checkTypeColors[failure.check_type] || 'bg-gray-100'}`}>
                      {failure.check_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    <div className="max-w-xs truncate" title={failure.error_message}>
                      {failure.error_message}
                    </div>
                    {failure.details && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-600">Details</summary>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-w-md">
                          {JSON.stringify(failure.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {failure.resolved_at ? (
                      <span className="text-green-600">Resolved</span>
                    ) : (
                      <span className="text-red-600">Unresolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}