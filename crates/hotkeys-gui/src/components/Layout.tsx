import type { ReactNode } from "react";
import { Body1, Subtitle2, Title2 } from "@fluentui/react-components";
import { useStyles } from "../styles/useStyles";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const styles = useStyles();
  return (
    <header className={styles.pageHeader}>
      <Title2 as="h1" block>
        {title}
      </Title2>
      {subtitle && (
        <Body1 className={styles.pageSubtitle} block>
          {subtitle}
        </Body1>
      )}
    </header>
  );
}

export function Group({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <section className={styles.group}>
      {title && (
        <Subtitle2 className={styles.groupTitle} as="h2">
          {title}
        </Subtitle2>
      )}
      <div className={styles.groupCard}>{children}</div>
    </section>
  );
}
