export interface MemberProfile {
  id: number;
  username: string;
  displayName: string;
}

export interface MemberMe extends MemberProfile {
  csrf: string;
}

export interface MemberUser extends MemberProfile {
  enabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface MemberList {
  rows: MemberUser[];
  page: number;
  hasMore: boolean;
}
