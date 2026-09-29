export type Account = {
  id: number;
  name: string;
  profileName: string;
  isAdmin: boolean;
  lesson: string;
  summary: string;
};

export type NamedId = {
  id: number;
  name: string;
};

export type ModuleAccess = {
  moduleKey: string;
  moduleLabel: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  roots: NamedId[];
  effectiveAreas: NamedId[];
  categories: NamedId[];
};

export type OrgNode = {
  id: number;
  name: string;
  children: OrgNode[];
};

export type AssetDecision = {
  id: number;
  name: string;
  area: NamedId | null;
  category: NamedId;
  listed: boolean;
  canRead: boolean;
  canWrite: boolean;
  readReason: string;
  writeReason: string;
};

export type CacheSource = "redis" | "postgres";

export type PermissionsProbe = {
  source: CacheSource;
};

export type AssetScope = {
  module: string;
  action: string;
  where: unknown;
};

export type AdminRestriction = {
  resourceType: string;
  dimension: string;
  valueId: number;
  name: string;
};

export type AdminGrant = {
  id: number;
  moduleKey: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  areaIds: NamedId[];
  restrictions: AdminRestriction[];
};

export type AdminProfile = {
  id: number;
  name: string;
  isAdmin: boolean;
  users: { id: number; name: string }[];
  grants: AdminGrant[];
};

export type GrantPatch = {
  profileId: number;
  moduleKey: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  areaIds: number[];
  restrictions: { resourceType: string; dimension: string; valueId: number }[];
};

export type Session = {
  user: {
    id: number;
    name: string;
    profileName: string;
    isAdmin: boolean;
  };
  lesson: string;
  modules: ModuleAccess[];
  org: OrgNode[];
  assets: AssetDecision[];
};
