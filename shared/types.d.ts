export type RaceStatus = "planned" | "running" | "finished";

export interface RaceEvent {
  id: string;
  name: string;
  date: string;
  status: RaceStatus;
  starts: RaceStart[];
}

export interface RaceStart {
  id: string;
  eventId: string;
  name: string;
  scheduledStartTime: string;
  actualStartTime?: string;
  procedureType: string;
  distanceNm?: number;
  status: RaceStatus;
  countdownTargetTime?: string;
  countdownRunning: boolean;
  countdownStartedAt?: string;
  warningFlagType: "class" | "number";
  warningFlagNumber?: number;
  warningFlagId?: string;
  manualSignalFlags: string[];
}

export interface ClassFlag {
  id: string;
  name: string;
  cssClass?: string;
  dataUrl?: string;
}

export interface Boat {
  id: string;
  startId: string;
  boatName: string;
  sailNumber: string;
  boatType: string;
  skipper: string;
  club: string;
  handicap?: number;
  source: "manual" | "websejler";
  certificate?: Certificate;
}

export interface Certificate {
  certificateNumber?: string;
  validUntil?: string;
  gph?: number;
  tcc?: number;
  tacil?: number;
  tacim?: number;
  tacih?: number;
  taudl?: number;
  taudm?: number;
  taudh?: number;
  raw: Record<string, unknown>;
  sourceUrl?: string;
}
