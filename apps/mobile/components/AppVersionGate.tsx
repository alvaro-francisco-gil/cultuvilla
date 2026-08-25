import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAppVersionConfig,
  resolveVersionGate,
  shouldPromptUpdate,
  type GateDecision,
  type UpdatePromptRecord,
} from '@cultuvilla/shared';
import { AppUpdateModal } from './AppUpdateModal';
import { getRunningVersion, getGatePlatform } from '../lib/appVersion';
import { useT } from '../lib/i18n';

const PROMPT_RECORD_KEY = 'cultuvilla:appUpdate:lastPrompt';

async function readPromptRecord(): Promise<UpdatePromptRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PROMPT_RECORD_KEY);
    return raw ? (JSON.parse(raw) as UpdatePromptRecord) : null;
  } catch {
    return null;
  }
}

async function writePromptRecord(record: UpdatePromptRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPT_RECORD_KEY, JSON.stringify(record));
  } catch {
    // A failed write only means we ask again next launch — never worth crashing.
  }
}

export function AppVersionGate({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [decision, setDecision] = useState<GateDecision | 'loading'>('loading');
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [nudgeVisible, setNudgeVisible] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const platform = getGatePlatform();
      if (platform === 'web') {
        setDecision('ok');
        return;
      }
      const config = await getAppVersionConfig();
      if (!active) return;
      const next = resolveVersionGate(getRunningVersion(), config, platform);
      setDecision(next);
      if (config) setStoreUrl(config.storeUrl[platform]);

      if (next === 'nudge' && config) {
        const latest = config[platform].latest;
        const record = await readPromptRecord();
        if (!active) return;
        if (shouldPromptUpdate(record, latest, Date.now())) {
          setNudgeVisible(true);
          void writePromptRecord({ version: latest, promptedAt: Date.now() });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openStore = useCallback(() => {
    if (storeUrl) void Linking.openURL(storeUrl);
  }, [storeUrl]);

  // Fail open: children always render. The hard blocker is a modal ON TOP of
  // them so a stale binary can't be used, but nothing is unmounted — a bad read
  // (null config, unparseable version) resolves to 'ok' and is invisible.
  return (
    <>
      {children}
      <AppUpdateModal
        visible={decision === 'block'}
        title={t('appUpdate.blockTitle')}
        body={t('appUpdate.blockBody')}
        ctaLabel={t('appUpdate.cta')}
        onUpdate={openStore}
      />
      <AppUpdateModal
        visible={decision === 'nudge' && nudgeVisible}
        title={t('appUpdate.nudgeTitle')}
        body={t('appUpdate.nudgeBody')}
        ctaLabel={t('appUpdate.cta')}
        onUpdate={() => {
          setNudgeVisible(false);
          openStore();
        }}
        onDismiss={() => setNudgeVisible(false)}
        dismissLabel={t('appUpdate.later')}
      />
    </>
  );
}
