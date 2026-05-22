import {
  Button,
  Caption1,
  Subtitle1,
} from "@fluentui/react-components";
import { Add20Regular, AppFolder20Regular } from "@fluentui/react-icons";
import { useStyles } from "../styles/useStyles";

export function NoProfilesEmpty({ onCreate }: { onCreate: () => void }) {
  const styles = useStyles();
  return (
    <div className={styles.emptyState}>
      <AppFolder20Regular style={{ fontSize: 28 }} />
      <Subtitle1>还没有任何配置</Subtitle1>
      <Caption1>
        点击左侧「+ 新建配置」创建一个，例如"魔兽争霸"或"真三国无双"。
      </Caption1>
      <Button
        appearance="primary"
        icon={<Add20Regular />}
        onClick={onCreate}
      >
        新建配置
      </Button>
    </div>
  );
}
