
$baseUrl = "http://localhost:4000/api/v1"
$credentials = @{
    email    = "superadmin@faiera.com"
    password = "P@ssword123!"
}
$imagePath = "e:\Faiera\dummy-image.jpg"
$filePath = "e:\Faiera\dummy-attachment.pdf"

# Helper function to print colored output
function Print-Status($message, $color = "Cyan") {
    Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] $message" -ForegroundColor $color
}

try {
    # 1. Login
    Print-Status "Logging in..."
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($credentials | ConvertTo-Json) -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
    $headers = @{ "Authorization" = "Bearer $token" }
    Print-Status "Login successful!" "Green"

    # 2. Get Program (or Create one)
    Print-Status "Fetching programs..."
    $programs = Invoke-RestMethod -Uri "$baseUrl/content/programs" -Method Get -Headers $headers -ContentType "application/json"
    
    if ($programs.data.items.Count -gt 0) {
        $programId = $programs.data.items[0].id
        Print-Status "Found existing Program ID: $programId"
    }
    else {
        Print-Status "No programs found. Creating a default program..."
        $programData = @{
            titleAr = "Default Program AR"
            titleEn = "Default Program EN"
            grade   = "Grade 10"
            subject = "General"
        }
        $newProgram = Invoke-RestMethod -Uri "$baseUrl/content/programs" -Method Post -Headers $headers -Body ($programData | ConvertTo-Json) -ContentType "application/json"
        $programId = $newProgram.data.id
        Print-Status "Created new Program ID: $programId" "Green"
    }

    # 3. Upload Image
    Print-Status "Uploading course image..."
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $imageBytes = [System.IO.File]::ReadAllBytes($imagePath)
    $imageContent = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($imageBytes)

    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"dummy-image.jpg`"",
        "Content-Type: image/jpeg",
        "",
        "$imageContent",
        "--$boundary--",
        ""
    ) -join $LF

    $uploadResponse = Invoke-RestMethod -Uri "$baseUrl/upload/image" -Method Post -Headers $headers -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines
    $imageUrl = $uploadResponse.data.url
    Print-Status "Image uploaded: $imageUrl" "Green"

    # 4. Create Course
    Print-Status "Creating course..."
    $courseData = @{
        titleAr       = "Test Course Backend AR"
        titleEn       = "Test Course Backend EN"
        descriptionAr = "Desc"
        descriptionEn = "Desc"
        subject       = "Mathematics"
        grade         = "Grade 12"
        term          = "Term 1"
        programId     = $programId
        thumbnailUrl  = $imageUrl
    }
    $course = Invoke-RestMethod -Uri "$baseUrl/content/courses" -Method Post -Headers $headers -Body ($courseData | ConvertTo-Json) -ContentType "application/json"
    $courseId = $course.data.id
    Print-Status "Course created: $courseId" "Green"

    # 5. Create Section
    Print-Status "Creating section..."
    $sectionData = @{
        titleAr  = "Section 1"
        titleEn  = "Section 1"
        courseId = $courseId
        order    = 1
    }
    $section = Invoke-RestMethod -Uri "$baseUrl/content/sections" -Method Post -Headers $headers -Body ($sectionData | ConvertTo-Json) -ContentType "application/json"
    $sectionId = $section.data.id
    Print-Status "Section created: $sectionId"

    # 6. Upload Attachment
    Print-Status "Uploading attachment..."
    $boundary2 = [System.Guid]::NewGuid().ToString()
    $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
    $fileContent = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($fileBytes)

    $bodyLines2 = (
        "--$boundary2",
        "Content-Disposition: form-data; name=`"file`"; filename=`"dummy-attachment.pdf`"",
        "Content-Type: application/pdf",
        "",
        "$fileContent",
        "--$boundary2--",
        ""
    ) -join $LF

    $fileUploadResponse = Invoke-RestMethod -Uri "$baseUrl/upload/file" -Method Post -Headers $headers -ContentType "multipart/form-data; boundary=$boundary2" -Body $bodyLines2
    $fileData = $fileUploadResponse.data
    Print-Status "File uploaded: $($fileData.url)" "Green"

    # 7. Create Lesson with Attachment
    Print-Status "Creating lesson with attachment..."
    $lessonData = @{
        titleAr     = "Lesson 1"
        titleEn     = "Lesson 1"
        sectionId   = $sectionId
        type        = "video"
        order       = 1
        attachments = @(
            @{
                id   = [System.Guid]::NewGuid().ToString()
                name = "dummy-attachment.pdf"
                url  = $fileData.url
                size = "10KB"
                type = "application/pdf"
            }
        )
    }
    $lesson = Invoke-RestMethod -Uri "$baseUrl/content/lessons" -Method Post -Headers $headers -Body ($lessonData | ConvertTo-Json) -ContentType "application/json"
    
    # 8. Verify
    if ($lesson.data.attachments.Count -gt 0) {
        Print-Status "SUCCESS! Lesson created with $($lesson.data.attachments.Count) attachments." "Green"
        Print-Status "Attachment URL: $($lesson.data.attachments[0].url)"
    }
    else {
        throw "Lesson created but attachments are missing!"
    }

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}
