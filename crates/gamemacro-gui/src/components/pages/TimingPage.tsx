import {
  SpinButton,
  type SpinButtonOnChangeData,
} from "@fluentui/react-components";
import { Timer20Regular } from "@fluentui/react-icons";
import type { Profile } from "../../lib/api";
import { Group, PageHeader } from "../Layout";
import { SettingRow } from "../SettingRow";

export interface TimingPageProps {
  profile: Profile;
  onChangeInterval: (v: number) => void;
  onChangeDelay: (v: number) => void;
}

export function TimingPage({
  profile,
  onChangeInterval,
  onChangeDelay,
}: TimingPageProps) {
  const handleSpin =
    (setter: (v: number) => void, min: number) =>
    (_: unknown, data: SpinButtonOnChangeData) => {
      const value = data.value ?? Number(data.displayValue ?? min);
      if (Number.isFinite(value)) setter(Math.max(min, Math.floor(value)));
    };

  return (
    <>
      <PageHeader
        title="输入节奏"
        subtitle={`当前配置「${profile.name}」的自动重发频率与按键间隔。`}
      />

      <Group title="计时">
        <SettingRow
          icon={<Timer20Regular />}
          label="自动输入间隔"
          desc="持续按住热键时，每隔多少秒重发一次输入。"
          control={
            <SpinButton
              min={1}
              step={1}
              value={profile.auto_input_interval_secs}
              displayValue={`${profile.auto_input_interval_secs} 秒`}
              onChange={handleSpin(onChangeInterval, 1)}
            />
          }
        />
        <SettingRow
          icon={<Timer20Regular />}
          label="按键间延迟"
          desc="模拟每次按键之间的等待时间，越大越稳定，越小越快。"
          divider={false}
          control={
            <SpinButton
              min={0}
              step={5}
              value={profile.input_delay_millis}
              displayValue={`${profile.input_delay_millis} 毫秒`}
              onChange={handleSpin(onChangeDelay, 0)}
            />
          }
        />
      </Group>
    </>
  );
}
