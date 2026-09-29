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
