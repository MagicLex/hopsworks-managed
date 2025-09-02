import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Badge, Select, Card } from 'tailwind-quartz';
import { FolderOpen, Loader, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface Project {
  name: string;
  id: number;
  namespace: string;
  role?: string;
}

interface TeamMemberProjectsProps {
  memberId: string;
  memberEmail: string;
  memberName: string;
  isOwner: boolean;
  ownerId: string;
}

export default function TeamMemberProjects({ 
  memberId, 
  memberEmail,
  memberName,
  isOwner,
  ownerId
}: TeamMemberProjectsProps) {
  const [memberProjects, setMemberProjects] = useState<Project[]>([]);
  const [ownerProjects, setOwnerProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map()); // projectName -> role
  const [saving, setSaving] = useState(false);

  const syncRoles = async () => {
    if (!isOwner) return;
    
    try {
      setSyncing(true);
      const response = await fetch('/api/team/sync-member-roles', {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('Failed to sync roles');
      } else {
        const result = await response.json();
        console.log('Sync result:', result);
      }
    } catch (error) {
      console.error('Failed to sync roles:', error);
    } finally {
      setSyncing(false);
    }
  };

  const fetchProjects = async () => {
    if (!expanded) return;
    
    try {
      setLoading(true);
      
      // If owner, sync roles from Hopsworks first
      if (isOwner) {
        await syncRoles();
      }
      
      // Fetch both member's current projects and owner's available projects
      const [memberResponse, ownerResponse] = await Promise.all([
        fetch(`/api/team/member-projects?memberId=${memberId}`),
        fetch(`/api/team/owner-projects`)
      ]);
      
      if (!memberResponse.ok) throw new Error('Failed to fetch member projects');
      if (!ownerResponse.ok) throw new Error('Failed to fetch owner projects');
      
      const memberData = await memberResponse.json();
      const ownerData = await ownerResponse.json();
      
      setMemberProjects(memberData.projects || []);
      setOwnerProjects(ownerData.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchProjects();
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateAndCleanProjects = async () => {
    if (!isOwner) return;
    
    try {
      setValidating(true);
      setMessage({ type: 'info', text: 'Validating projects with Hopsworks...' });
      
      const response = await fetch('/api/admin/sync-projects', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to validate projects');
      }
      
      const result = await response.json();
      setMessage({ 
        type: 'success', 
        text: `Validated ${result.stats.projectsInHopsworks} projects. Cleaned ${result.stats.deletedProjects} stale entries.`
      });
      
      // Refresh after validation
      await fetchProjects();
      
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Failed to validate projects:', error);
      setMessage({ type: 'error', text: 'Failed to validate projects' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setValidating(false);
    }
  };

  const updateProjectRole = async (projectName: string, projectId: number, role: string, action: 'add' | 'remove') => {
    if (!isOwner) return;
    
    try {
      setUpdating(projectName);
      setMessage(null);
      
      const response = await fetch('/api/team/member-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          projectName,
          projectId,
          role,
          action
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Check if it's a project not found error
        if (result.error?.includes('does not exist') || result.error?.includes('not found')) {
          setMessage({ 
            type: 'error', 
            text: `Project '${projectName}' no longer exists. Run validation to clean up.`
          });
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to update role' });
        }
        throw new Error(result.error || 'Failed to update project role');
      }

      // Success!
      setMessage({ 
        type: 'success', 
        text: action === 'add' 
          ? `Added ${memberName || memberEmail} to ${projectName} as ${role}`
          : `Removed ${memberName || memberEmail} from ${projectName}`
      });
      
      // Refresh projects
      await fetchProjects();
      
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <Box className="mt-3">
      <Flex gap={8}>
        <Button
          onClick={handleToggle}
          size="sm"
          intent="ghost"
          className="text-xs"
        >
          <FolderOpen size={14} className="mr-1" />
          {expanded ? 'Hide' : 'Manage'} Projects
        </Button>
        
        {isOwner && expanded && (
          <Button
            onClick={validateAndCleanProjects}
            size="sm"
            intent="ghost"
            className="text-xs"
            disabled={validating}
          >
            {validating ? (
              <><Loader className="animate-spin mr-1" size={14} /> Validating...</>
            ) : (
              <><RefreshCw size={14} className="mr-1" /> Validate Projects</>
            )}
          </Button>
        )}
      </Flex>

      {expanded && (
        <Card className="mt-3 p-3 bg-gray-50">
          <Text className="text-sm font-medium mb-2">
            Project Access for {memberName || memberEmail}
          </Text>
          
          {message && (
            <Box 
              className={`mb-3 p-2 rounded border ${
                message.type === 'error' ? 'bg-red-50 border-red-200' : 
                message.type === 'success' ? 'bg-green-50 border-green-200' : 
                'bg-blue-50 border-blue-200'
              }`}
            >
              <Flex align="center" gap={8}>
                {message.type === 'success' && <CheckCircle size={16} className="text-green-600" />}
                {message.type === 'error' && <AlertCircle size={16} className="text-red-600" />}
                <Text className={`text-sm ${
                  message.type === 'error' ? 'text-red-800' : 
                  message.type === 'success' ? 'text-green-800' : 
                  'text-blue-800'
                }`}>{message.text}</Text>
              </Flex>
            </Box>
          )}
          
          {loading || syncing ? (
            <Flex align="center" justify="center" className="py-4">
              <Loader className="animate-spin" size={16} />
              <Text className="ml-2 text-sm text-gray-600">
                {syncing ? 'Syncing with Hopsworks...' : 'Loading projects...'}
              </Text>
            </Flex>
          ) : (
            <Box className="space-y-3">
              {/* Member's current projects */}
              {memberProjects.length > 0 && (
                <Box>
                  <Text className="text-xs font-medium text-gray-700 mb-2">Current Access</Text>
                  <Box className="space-y-2">
                    {memberProjects.map(project => (
                <Flex 
                  key={project.namespace} 
                  justify="between" 
                  align="center"
                  className="p-2 bg-white rounded border border-gray-200"
                >
                  <Box>
                    <Text className="text-sm font-medium">{project.name}</Text>
                    <Text className="text-xs text-gray-500">ID: {project.id}</Text>
                  </Box>
                  <Flex gap={8} align="center">
                    {project.role && (
                      <Badge size="sm" variant="default">
                        {project.role}
                      </Badge>
                    )}
                    {isOwner && (
                      <Select
                        value={pendingChanges.get(project.name) || project.role || 'current'}
                        onChange={(e) => {
                          const value = e.target.value;
                          const newChanges = new Map(pendingChanges);
                          if (value === 'remove' || (value !== project.role && value !== 'current')) {
                            newChanges.set(project.name, value);
                          } else {
                            newChanges.delete(project.name);
                          }
                          setPendingChanges(newChanges);
                        }}
                        disabled={saving}
                        className={`text-xs ${pendingChanges.has(project.name) ? 'border-blue-500' : ''}`}
                        style={{ width: '140px' }}
                      >
                        <option value="current" disabled>Current: {project.role || 'Unknown'}</option>
                        <option value="Data owner">Data owner</option>
                        <option value="Data scientist">Data scientist</option>
                        <option value="Observer">Observer</option>
                        <option value="remove">Remove Access</option>
                      </Select>
                    )}
                  </Flex>
                </Flex>
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Available projects to add */}
              {isOwner && ownerProjects.length > 0 && (
                <Box>
                  <Text className="text-xs font-medium text-gray-700 mb-2">
                    {memberProjects.length === 0 ? 'Your Projects' : 'Add to More Projects'}
                  </Text>
                  <Box className="space-y-2">
                    {ownerProjects
                      .filter(p => !memberProjects.some(mp => mp.name === p.name))
                      .map(project => (
                        <Flex 
                          key={project.namespace} 
                          justify="between" 
                          align="center"
                          className="p-2 bg-white rounded border border-gray-200 opacity-75"
                        >
                          <Box>
                            <Text className="text-sm font-medium">{project.name}</Text>
                            <Text className="text-xs text-gray-500">Not added yet</Text>
                          </Box>
                          <Select
                            value={pendingChanges.get(project.name) || 'select'}
                            onChange={(e) => {
                              const role = e.target.value;
                              if (role && role !== 'select') {
                                const newChanges = new Map(pendingChanges);
                                newChanges.set(project.name, role);
                                setPendingChanges(newChanges);
                              }
                            }}
                            disabled={saving}
                            className={`text-xs ${pendingChanges.has(project.name) ? 'border-blue-500' : ''}`}
                            style={{ width: '140px' }}
                          >
                            <option value="select">Add with role...</option>
                            <option value="Data scientist">Data scientist</option>
                            <option value="Data owner">Data owner</option>
                            <option value="Observer">Observer</option>
                          </Select>
                        </Flex>
                      ))}
                  </Box>
                </Box>
              )}
              
              {memberProjects.length === 0 && ownerProjects.length === 0 && (
                <Text className="text-sm text-gray-600">
                  No projects available. Create projects in Hopsworks first.
                </Text>
              )}
            </Box>
          )}
          
          {isOwner && pendingChanges.size > 0 && (
            <Box className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <Flex justify="between" align="center">
                <Text className="text-xs text-yellow-800">
                  <strong>{pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}</strong>
                </Text>
                <Flex gap={8}>
                  <Button
                    size="sm"
                    intent="ghost"
                    onClick={() => setPendingChanges(new Map())}
                    disabled={saving}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    intent="primary"
                    onClick={async () => {
                      setSaving(true);
                      setMessage(null);
                      let successCount = 0;
                      let errorCount = 0;
                      
                      const changes = Array.from(pendingChanges.entries());
                      for (const [projectName, role] of changes) {
                        const project = [...memberProjects, ...ownerProjects].find(p => p.name === projectName);
                        if (project) {
                          try {
                            await updateProjectRole(
                              projectName, 
                              project.id, 
                              role === 'remove' ? '' : role, 
                              role === 'remove' ? 'remove' : 'add'
                            );
                            successCount++;
                          } catch (error) {
                            errorCount++;
                          }
                        }
                      }
                      
                      if (successCount > 0 && errorCount === 0) {
                        setMessage({ 
                          type: 'success', 
                          text: `Successfully updated ${successCount} role${successCount > 1 ? 's' : ''}`
                        });
                        setPendingChanges(new Map());
                      } else if (errorCount > 0) {
                        setMessage({ 
                          type: 'error', 
                          text: `Updated ${successCount}, failed ${errorCount}. Check project availability.`
                        });
                      }
                      
                      setSaving(false);
                      setTimeout(() => setMessage(null), 5000);
                    }}
                    disabled={saving}
                    className="text-xs"
                  >
                    {saving ? (
                      <><Loader className="animate-spin mr-1" size={14} /> Saving...</>
                    ) : (
                      <>Save Changes</>
                    )}
                  </Button>
                </Flex>
              </Flex>
            </Box>
          )}
          
          {isOwner && (
            <Box className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <Text className="text-xs text-blue-800">
                <strong>Tip:</strong> Select role changes and click Save to apply them.
              </Text>
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}