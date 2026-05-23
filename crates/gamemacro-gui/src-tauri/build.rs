// tauri-build 默认会自动嵌一份 Windows manifest（带 Common-Controls v6 依赖）。
// 我们走官方 WindowsAttributes::app_manifest 覆盖它，加上 requireAdministrator
// trustInfo —— 这是与 tauri-build 内部资源链路兼容的唯一姿势，winres /
// embed-resource 自行嵌 manifest 会产生 CVTRES CVT1100 资源重复链接错误。
//
// debug build 不挂 admin manifest（仍走 tauri-build 默认 asInvoker），方便
// `cargo run` / `cargo tauri dev` 在普通 PowerShell 里看 stdout；hotkey
// 在 debug 下会因无 admin 而静默失效，这是有意为之。

#[cfg(all(windows, not(debug_assertions)))]
const ADMIN_MANIFEST: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"#;

fn main() {
    #[cfg_attr(not(all(windows, not(debug_assertions))), allow(unused_mut))]
    let mut attrs = tauri_build::Attributes::new();

    #[cfg(all(windows, not(debug_assertions)))]
    {
        let windows = tauri_build::WindowsAttributes::new().app_manifest(ADMIN_MANIFEST);
        attrs = attrs.windows_attributes(windows);
    }

    tauri_build::try_build(attrs).expect("tauri-build failed");
}
