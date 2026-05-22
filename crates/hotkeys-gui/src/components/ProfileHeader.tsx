import { AppFolder20Regular } from "@fluentui/react-icons";
import type { Profile } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export function ProfileHeader({ profile }: { profile: Profile }) {
  const styles = useStyles();
  return (
    <div className={styles.profileHeader}>
      <div className={styles.profileHeaderIcon}>
        <AppFolder20Regular />
      </div>
      <div className={styles.profileHeaderText}>
        <span className={styles.profileHeaderTitle}>{profile.name}</span>
        <span className={styles.profileHeaderMeta}>
          {profile.window_keywords.length === 0
            ? "未设置窗口关键词"
            : `匹配窗口：${profile.window_keywords.join(" / ")}`}
        </span>
      </div>
    </div>
  );
}
