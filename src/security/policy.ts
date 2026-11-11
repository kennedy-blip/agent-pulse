import type { SecurityPolicy } from '../types';

export const DEFAULT_POLICIES: SecurityPolicy[] = [
  { id: 'pol_rmrf', name: 'Recursive force delete', description: 'rm -rf on any path', pattern: String.raw`\brm\s+-(?:[a-z]*r[a-z]*f|[a-z]*f[a-z]*r)\b`, risk: 'high', category: 'destructive_shell', enabled: true },
  { id: 'pol_force', name: 'Force push', description: 'git push --force / -f to any remote', pattern: String.raw`\bgit\s+push\b.*(?:--force\b|\s-f\b)`, risk: 'critical', category: 'force_push', enabled: true },
  { id: 'pol_reset', name: 'Hard reset / branch delete', description: 'git reset --hard, git branch -D', pattern: String.raw`\bgit\s+(?:reset\s+--hard|branch\s+-D)\b`, risk: 'high', category: 'branch_override', enabled: true },
  { id: 'pol_sql', name: 'Destructive SQL', description: 'DROP / TRUNCATE / DELETE without WHERE', pattern: String.raw`\b(?:drop\s+(?:table|database|schema)|truncate\s+table)\b`, risk: 'critical', category: 'data_mutation', enabled: true },
  { id: 'pol_k8s', name: 'Production cluster mutation', description: 'kubectl delete / terraform apply|destroy', pattern: String.raw`\b(?:kubectl\s+delete|terraform\s+(?:apply|destroy))\b`, risk: 'critical', category: 'prod_deploy', enabled: true },
  { id: 'pol_secret', name: 'Credential file access', description: 'Reading ~/.aws, ~/.ssh, .env secrets', pattern: String.raw`(?:\.aws/credentials|\.ssh/id_|\bcat\s+\.env\b|printenv\s+\w*(?:KEY|SECRET|TOKEN))`, risk: 'high', category: 'secret_access', enabled: true },
  { id: 'pol_pipe', name: 'Remote script execution', description: 'curl | sh, wget | bash', pattern: String.raw`\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b`, risk: 'high', category: 'destructive_shell', enabled: true },
  { id: 'pol_chmod', name: 'World-writable permissions', description: 'chmod 777 / chmod -R 777', pattern: String.raw`\bchmod\s+(?:-R\s+)?777\b`, risk: 'medium', category: 'destructive_shell', enabled: false },
];

export function classifyCommand(command: string, policies: SecurityPolicy[]): SecurityPolicy | null {
  for (const p of policies) {
    if (!p.enabled) continue;
    try {
      if (new RegExp(p.pattern, 'i').test(command)) return p;
    } catch {
      // ignore invalid user-supplied patterns
    }
  }
  return null;
}

export const CATEGORY_LABEL: Record<SecurityPolicy['category'], string> = {
  destructive_shell: 'Destructive shell',
  force_push: 'Force push',
  branch_override: 'Branch override',
  secret_access: 'Secret access',
  prod_deploy: 'Production deploy',
  data_mutation: 'Data mutation',
};
