## 1. Implement XHR Cancellation

- [x] 1.1 Add xhrRef using useRef to store XMLHttpRequest for access in cancel handler
- [x] 1.2 Store xhr in xhrRef.current in handleUpload before sending
- [x] 1.3 Create handleCancelUpload function that calls xhrRef.current?.abort()
- [x] 1.4 Add cleanup in useEffect to abort upload on component unmount

## 2. Add Cancel UI

- [x] 2.1 Add CloseOutlined icon import from @ant-design/icons
- [x] 2.2 Add cancel button next to progress bar in uploading state
- [x] 2.3 Set status to "Upload cancelled" when abort event fires
- [x] 2.4 Disable cancel button after cancellation completes

## 3. Test and Verify

- [ ] 3.1 Test cancel button during upload stops the upload
- [ ] 3.2 Verify status shows cancelled message
- [ ] 3.3 Verify user can select new file and upload after cancellation
