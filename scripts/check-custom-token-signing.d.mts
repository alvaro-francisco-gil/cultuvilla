// Types for the ops script's testable exports. The script itself stays plain
// .mjs (it runs via bare `node` in CI, before any build step), so its pure
// predicate is declared here rather than suppressed at each import site.

export declare const ROLE: 'roles/iam.serviceAccountTokenCreator';

export interface IamBinding {
  role?: string;
  members?: string[];
}

export interface IamPolicy {
  bindings?: IamBinding[];
}

/** True when `saEmail` holds ROLE on itself — the binding createCustomToken needs. */
export declare function selfSignBindingExists(policy: IamPolicy, saEmail: string): boolean;
