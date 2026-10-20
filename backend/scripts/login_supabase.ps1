Set-Location $PSScriptRoot\..

$envValues = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
        $envValues[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
}

$supabaseUrl = $envValues["SUPABASE_URL"].TrimEnd("/")
$anonKey = $envValues["SUPABASE_ANON_KEY"]

if ([string]::IsNullOrWhiteSpace($supabaseUrl) -or [string]::IsNullOrWhiteSpace($anonKey)) {
    throw "SUPABASE_URL atau SUPABASE_ANON_KEY tidak tersedia di backend\.env."
}

$email = Read-Host "Email admin"
$passwordSecure = Read-Host "Password admin" -AsSecureString
$password = [System.Net.NetworkCredential]::new("", $passwordSecure).Password
$body = @{ email = $email; password = $password } | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Method Post `
        -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
        -Headers @{ apikey = $anonKey } `
        -ContentType "application/json" `
        -Body $body

    $payload = $response.Content | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($payload.access_token)) {
        Write-Error "Supabase merespons $($response.StatusCode), tetapi tidak mengirim access_token."
        exit 1
    }

    Set-Variable -Name token -Value $payload.access_token -Scope Global
    Write-Host "Login berhasil. Token disimpan di variabel `$token untuk sesi PowerShell ini."
}
catch {
    $status = $_.Exception.Response.StatusCode.value__
    $rawError = $_.ErrorDetails.Message
    if ([string]::IsNullOrWhiteSpace($rawError) -and $_.Exception.Response.Content) {
        $rawError = $_.Exception.Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    }
    $errorBody = $rawError | ConvertFrom-Json
    $message = $errorBody.msg
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = $errorBody.error_description
    }
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = $errorBody.error
    }
    Write-Error "Supabase login gagal (HTTP $status): $message"
    exit 1
}
