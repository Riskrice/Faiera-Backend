
# Browser Verification Plan

## Goal
Verify that the teacher can access the "Add Course" wizard and reach the video upload step.

## Steps
1.  **Login**: Go to `http://localhost:3001/auth/login`. Login with `teacher@faiera.com` / `P@ssword123!`.
2.  **Navigate**: Go to `http://localhost:3001/dashboard/courses`.
3.  **Start Wizard**: Click "New Course" (كورس جديد).
4.  **Fill Basics**: Enter dummy title "Test Video Course".
5.  **Skip to Curriculum**: Click "Next" until Step 3.
6.  **Add Lesson**: Click "Add Section" -> "Add Lesson".
7.  **Verify Uploader**: Check if "Upload Video" area is visible.
