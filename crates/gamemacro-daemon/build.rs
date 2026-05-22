fn main() {
    let mut res = winres::WindowsResource::new();
    res.set_manifest_file("app.manifest");
    // 显式设置一些字段，避免 winres 生成的 VERSIONINFO 缺关键字导致 RC 编译失败
    res.set("ProductName", "Hotkeys Daemon");
    res.set("FileDescription", "Hotkeys Daemon");
    res.set("CompanyName", "");
    res.set("LegalCopyright", "");
    res.set_version_info(winres::VersionInfo::FILEVERSION, 0x0001_0000_0000);
    res.set_version_info(winres::VersionInfo::PRODUCTVERSION, 0x0001_0000_0000);
    if let Err(e) = res.compile() {
        // 不致命：在非 MSVC 工具链下 winres 可能失败，回退为不带 manifest
        eprintln!("winres compile failed: {e}");
    }
}
