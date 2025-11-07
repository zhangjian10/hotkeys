use std::process::{Command, exit};
use std::env;
use winapi::{
    um::{
        handleapi::CloseHandle,
        processthreadsapi::{GetCurrentProcess, OpenProcessToken},
        securitybaseapi::GetTokenInformation,
        winnt::{TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
    },
    shared::minwindef::{DWORD, FALSE},
};

/// 检查当前进程是否以管理员权限运行
pub fn is_elevated() -> bool {
    unsafe {
        let mut token_handle = std::ptr::null_mut();
        
        // 获取当前进程的访问令牌
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle) == FALSE {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut return_length: DWORD = 0;

        // 查询令牌信息以确定是否具有提升权限
        let result = GetTokenInformation(
            token_handle,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as DWORD,
            &mut return_length,
        );

        CloseHandle(token_handle);

        if result == FALSE {
            return false;
        }

        elevation.TokenIsElevated != 0
    }
}

/// 如果没有管理员权限，重新启动程序并请求管理员权限
pub fn request_elevation() -> ! {
    let current_exe = env::current_exe().expect("Failed to get current executable path");
    let args: Vec<String> = env::args().skip(1).collect();
    
    println!("Requesting administrator privileges...");
    
    // 使用 runas 动词通过 ShellExecute 重新启动程序
    let mut cmd = Command::new("powershell");
    cmd.arg("-Command")
       .arg(format!(
           "Start-Process '{}' {} -Verb RunAs",
           current_exe.display(),
           if args.is_empty() {
               String::new()
           } else {
               format!("-ArgumentList '{}'", args.join("', '"))
           }
       ));

    match cmd.spawn() {
        Ok(_) => {
            println!("Restarting with administrator privileges...");
            exit(0);
        }
        Err(e) => {
            eprintln!("Failed to restart with administrator privileges: {}", e);
            eprintln!("Please run this program as administrator manually.");
            exit(1);
        }
    }
}

/// 确保程序以管理员权限运行，如果没有则自动请求
pub fn ensure_elevated() {
    if !is_elevated() {
        println!("This program requires administrator privileges to work properly.");
        println!("Global hotkey monitoring requires elevated permissions.");
        request_elevation();
    } else {
        println!("Running with administrator privileges ✓");
    }
}
