import type {
  MonitoredArr,
  MonitoredCertificate,
  MonitoredHomeAssistant,
  MonitoredMedia,
  MonitoredNtopng,
  MonitoredOpnsense,
  MonitoredSeerr,
  MonitoredUsenet,
} from '../../types';

export type SectionKey =
  | 'general'
  | 'hosts'
  | 'solar'
  | 'docker'
  | 'media'
  | 'usenet'
  | 'arr'
  | 'seerr'
  | 'network'
  | 'home'
  | 'certs'
  | 'alerts';

/** Sections whose list items are edited through EntityModalDialog. */
export type EntityModalSection = Extract<
  SectionKey,
  'media' | 'usenet' | 'arr' | 'seerr' | 'network' | 'home' | 'certs'
>;

/** All fields any entity dialog can produce. Individual sections only render
 *  the subset they care about; handleSaveEntity narrows by section. */
export interface EntityFormValues {
  id?: string;
  name?: string;
  url?: string;
  host?: string;
  port?: number;
  type?: string;
  apiKey?: string;
  apiSecret?: string;
  token?: string;
  username?: string;
  password?: string;
  ifid?: number;
  insecureTls?: boolean;
  _type?: 'opnsense' | 'ntopng';
}

type EntityDraftMap = {
  media: Partial<MonitoredMedia>;
  usenet: Partial<MonitoredUsenet>;
  arr: Partial<MonitoredArr>;
  seerr: Partial<MonitoredSeerr>;
  network:
    | (Partial<MonitoredOpnsense> & { _type?: 'opnsense' })
    | (Partial<MonitoredNtopng> & { _type?: 'ntopng' });
  home: Partial<MonitoredHomeAssistant>;
  certs: Partial<MonitoredCertificate>;
};

export type EntityModalState = {
  [K in EntityModalSection]: {
    open: boolean;
    isNew: boolean;
    section: K;
    item: EntityDraftMap[K];
  };
}[EntityModalSection];
