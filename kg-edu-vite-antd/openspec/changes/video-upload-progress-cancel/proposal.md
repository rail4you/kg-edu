## Why

Currently the video upload component shows a progress bar during upload, but users cannot cancel an in-progress upload. This creates a poor user experience when users accidentally select the wrong file or want to stop an upload for any reason. Adding a cancel button will improve usability and prevent wasted bandwidth.

## What Changes

- Add cancel button to video upload component that allows users to abort an in-progress upload
- Store the XMLHttpRequest reference in a ref to enable calling `.abort()`
- Show appropriate UI states when upload is cancelled
- Clean up any resources after cancellation

## Capabilities

### New Capabilities
- `video-upload-cancel`: Allow users to cancel an in-progress video upload with a cancel button

### Modified Capabilities
- None

## Impact

- File: `src/pages/teacher/video-uploader.tsx` - Add cancel functionality
- No API changes required (cancellation is client-side)
- No new dependencies
