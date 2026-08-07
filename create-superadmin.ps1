# ══════════════════════════════════════════════════════
#  Bartolomed — Crear SUPER_ADMIN
#  Requiere: Windows con PowerShell 5+ (viene preinstalado)
#  Uso: clic derecho → "Ejecutar con PowerShell"
# ══════════════════════════════════════════════════════

$API = "https://bartolomed.tecnocondor.dev/api"

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   Bartolomed — Crear SUPER_ADMIN     ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$Email     = Read-Host "  Email"
$FirstName = Read-Host "  Nombre"
$LastName  = Read-Host "  Apellido"
$Pass      = Read-Host "  Contraseña     " -AsSecureString
$Pass2     = Read-Host "  Confirmar      " -AsSecureString
$Token     = Read-Host "  GOD_MODE_TOKEN " -AsSecureString

# Comparar contraseñas
$PlainPass  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Pass))
$PlainPass2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Pass2))
$PlainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Token))

if ($PlainPass -ne $PlainPass2) {
    Write-Host ""
    Write-Host "  ✗ Las contraseñas no coinciden." -ForegroundColor Red
    Read-Host "`nPresiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "  Conectando a $API ..." -ForegroundColor Gray

$Body = @{
    email     = $Email
    password  = $PlainPass
    firstName = $FirstName
    lastName  = $LastName
    mode      = "create"
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod `
        -Uri "$API/auth/godmode/super-admin" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{ "x-god-token" = $PlainToken } `
        -Body $Body

    Write-Host ""
    Write-Host "  ✓ SUPER_ADMIN creado: $Email" -ForegroundColor Green
}
catch {
    $Code = $_.Exception.Response.StatusCode.value__
    Write-Host ""
    Write-Host "  ✗ Error HTTP $Code" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
}

Write-Host ""
Read-Host "Presiona Enter para salir"
