## Context

The video upload component (`src/pages/teacher/video-uploader.tsx`) currently displays a progress bar during upload but lacks the ability to cancel. Users need a way to abort uploads they no longer wish to continue.

## Goals / Non-Goals

**Goals:**
- Add cancel button to video upload UI
- Implement XHR abort functionality
- Handle cleanup after cancellation

**Non-Goals:**
- Server-side upload cancellation (not supported by backend)
- Chunked upload with resume capability
- Multiple file upload cancellation

## Decisions

1. **Use XMLHttpRequest for cancellation**
   - XMLHttpRequest supports `.abort()` method natively
   - The current implementation already uses XHR, so no refactoring needed
   - Alternative: Fetch API with AbortController - but would require refactoring existing code

2. **Store XHR in useRef for access**
   - Current code uses local xhr variable in handleUpload function
   - Need to move xhr to a useRef to make it accessible for cancellation
   - Alternative: Use useState but would cause re-renders - useRef is better for XHR storage

3. **UI placement: beside progress bar**
   - Add cancel button next to or below the progress indicator
   - Show "cancelled" status after abort completes
   - Disable cancel button when not uploading

## Risks / Trade-offs

- **Risk**: Race condition if user clicks cancel after upload completes
  - **Mitigation**: Check xhr readyState before calling abort, set uploading=false immediately

- **Risk**: Memory leak if component unmounts during upload
  - **Mitigation**: Add cleanup in useEffect to abort on unmount
