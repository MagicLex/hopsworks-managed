# SAAS Cluster Infrastructure (TLDR)

Quick reference for the underlying Hopsworks cluster infrastructure. Full details in internal Confluence doc.

## Cluster: saas-de

| Resource | Details |
|----------|---------|
| Provider | OVH (SAAS project) |
| K8s version | 1.33 |
| Hopsworks version | 4.6.0-rc0 |
| Management | run.hopsworks.ai |
| API server | `https://e5jx92.c1.de1.k8s.ovh.net` |
| Docker registry | `5306f185.c1.de1.container-registry.ovh.net` |

## Node Pools

| Pool | Nodes | Specs | Purpose |
|------|-------|-------|---------|
| head | 8 | 32G / 8 CPU | Stateful services |
| db | 4 | 64G / 8 CPU | RonDB datanodes |
| worker | autoscale | 32G / 8 CPU | Workloads |

## Access Levels

| Level | Use case | Source |
|-------|----------|--------|
| UI Admin | Day-to-day ops | run.hopsworks.ai (ask Lex) |
| Debug kubeconfig | Read-only + exec | AWS Secret Manager: `Production/OVH/SAAS-DE/Debug-KubeConfig` |
| Admin kubeconfig | Emergency fixes only | AWS Secret Manager: `Production/OVH/SAAS-DE/ADMIN-KubeConfig` |

**IP restriction**: Cluster API requires IP whitelist. Add yours via OVH console → Managed Kubernetes → saas-de → APIServer Access.

## What hopsworks-managed Uses

| Feature | How we access | Config location |
|---------|---------------|-----------------|
| Hopsworks API | HTTPS via `api_url` | `hopsworks_clusters.api_url` |
| API auth | Service account key | `hopsworks_clusters.api_key` |
| OpenCost metrics | `kubectl exec` | `hopsworks_clusters.kubeconfig` |
| User creation | `/admin/users` endpoint | Via API |
| User status | `/admin/users/{id}` PUT | Via API |
| Project membership | `/admin/projects/add-to-projects` | Via API |

## During Upgrades

Upgrades are **manual** via GitHub Actions on `hopsworks-as-a-service` repo.

**Impact on hopsworks-managed:**
- API calls may fail temporarily (user creation, suspension, project access)
- OpenCost collection may fail
- Code handles failures gracefully (logs error, continues)
- Users may have inconsistent state until next sync

**Monitor:** Vercel logs for `[suspendUser]`, `[reactivateUser]`, `[assignUserToCluster]` errors during upgrade windows.

## Secrets

All in AWS Secret Manager (Ohio, production account):

| Secret | Contents |
|--------|----------|
| `Production/OVH/SAAS-DE` | Helm values, Harbor creds |
| `Production/OVH/SAAS-DE/Debug-KubeConfig` | Read-only kubeconfig |
| `Production/OVH/SAAS-DE/ADMIN-KubeConfig` | Full admin kubeconfig |

## Quick Troubleshooting

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| User created but no Hopsworks access | API call failed during signup | Vercel logs for cluster-assignment errors |
| User suspended in DB but active in Hopsworks | `updateHopsworksUserStatus` failed | Vercel logs for `[suspendUser]` |
| OpenCost returning zeros | kubeconfig invalid or pod not ready | `/api/usage/collect-opencost` logs |
| All API calls failing | Cluster upgrade in progress or IP not whitelisted | Check run.hopsworks.ai status |

## Links

- OVH Console: SAAS project
- Cluster management: run.hopsworks.ai
- Helm config: `hopsworks-as-a-service` repo
- Full docs: Internal Confluence (SAAS cluster article)
