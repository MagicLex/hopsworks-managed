## General Information
Each user is allocated to a cluster in the database. In the `hopsworks_clusters` table, each cluster has an admin API, a kubeconfig attached, and an ID. This ID is used to map individual users to their clusters in the `user_hopsworks_assignments` table.

**Important**: Hopsworks users are created during cluster assignment with the following project limits:
- **Account owners (billing users)**: 5 projects (`maxNumProjects: 5`)
- **Team members**: 0 projects (`maxNumProjects: 0`)

The `hopsworks_user_id` is stored in both `users` and `user_hopsworks_assignments` tables for API operations. 

## New Cluster
When setting up a new cluster, for it to be configured to work with the saas service you need to do the following actions in each of the platforms;

### In Hopsworks
In **cluster settings** setup the OAuth identity provider with Auth0;
- Name; Auth0
- Connection Url; https://dev-fur3a3gej0xmnk7f.eu.auth0.com
- Client Id; fKsp6ZBzMPuxk79fP1C1TJ4F2TBOfRvZ
- Secret; the secret in Auth0

leave the remaining fields (given name, family name, group claim, email claim) empty. 

#### In the cluster configurations;
- `oauth_account_status` set to 2, for users to be activated when they login.
- `oauth_group_mapping` set to **ANY_GROUP->HOPS_USER**
- `oauth_group_mapping_enabled` set to **TRUE**
- `oauth_enabled` set to **TRUE**
- `oauth_group_mapping_sync_enabled` set to **TRUE** (enables automatic project assignment based on OAuth groups)
- `REMOTE_AUTH_NEED_CONSENT` set to **FALSE**
- `max_num_proj_per_user` set to 0

More documentation on hopsworks' configuration at [this link](https://docs.hopsworks.ai/latest/setup_installation/admin/oauth2/create-client)


__NotaBene: if you used an installer to deploy Hopsworks, remember to change the admin's  logins/passwords.__ 

### In Auth0
Replace or add all the callback links, CORS etc. 

### In Supabase
Add or replace a new entry in the `hopsworks_clusters` table. If you choose to replace an existing entry; users that are assigned to that entry will be assigned to the new cluster. 

### Install OpenCost
After Hopsworks installation, install OpenCost for usage tracking:

```yaml
# opencost-values.yaml
opencost:
  prometheus:
    internal:
      enabled: true
      serviceName: hopsworks-release-prometheus-server
      namespaceName: hopsworks
      port: 80
```

```bash
helm repo add opencost https://opencost.github.io/opencost-helm-chart
helm install opencost opencost/opencost \
  --namespace opencost --create-namespace \
  --values opencost-values.yaml

# Verify pods are running 
kubectl get pods -n opencost
```

Upload the kubeconfig to the admin or in supabase panel at `/admin47392` and verify OpenCost shows "Active" status.

