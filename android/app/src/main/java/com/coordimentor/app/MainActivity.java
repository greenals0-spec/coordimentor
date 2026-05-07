import android.webkit.JavascriptInterface;

public class MainActivity extends BridgeActivity {
  private String lastSharedImagePath = null;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FirebaseAuthenticationPlugin.class);
    super.onCreate(savedInstanceState);

    // 자바스크립트 인터페이스 등록 (리액트에서 즉시 호출 가능)
    getBridge().getWebView().addJavascriptInterface(new Object() {
      @JavascriptInterface
      public String getSharedImagePath() {
        return lastSharedImagePath;
      }
      
      @JavascriptInterface
      public void clearSharedImagePath() {
        lastSharedImagePath = null;
      }
    }, "AndroidShare");

    // SharedArrayBuffer 활성화 및 페이지 로딩 완료 시 이미지 주입 (백업용)
    getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        WebResourceResponse response = super.shouldInterceptRequest(view, request);
        if (response != null) {
          Map<String, String> headers = new HashMap<>(
            response.getResponseHeaders() != null ? response.getResponseHeaders() : new HashMap<>()
          );
          headers.put("Cross-Origin-Opener-Policy", "same-origin");
          headers.put("Cross-Origin-Embedder-Policy", "credentialless");
          response.setResponseHeaders(headers);
        }
        return response;
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (lastSharedImagePath != null) {
          injectSharedImage(lastSharedImagePath);
        }
      }
    });

    handleIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handleIntent(intent);
  }

  private void handleIntent(Intent intent) {
    String action = intent.getAction();
    String type = intent.getType();

    if (Intent.ACTION_SEND.equals(action) && type != null) {
      if (type.startsWith("image/")) {
        Uri imageUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (imageUri != null) {
          processSharedImage(imageUri);
        }
      }
    }
  }

  private void processSharedImage(Uri uri) {
    try {
      InputStream inputStream = getContentResolver().openInputStream(uri);
      java.io.File cacheDir = getCacheDir();
      java.io.File tempFile = new java.io.File(cacheDir, "shared_image.jpg");
      java.io.FileOutputStream outputStream = new java.io.FileOutputStream(tempFile);
      
      byte[] buffer = new byte[1024];
      int len;
      while ((len = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, len);
      }
      outputStream.close();
      inputStream.close();

      lastSharedImagePath = tempFile.getAbsolutePath();
      injectSharedImage(lastSharedImagePath);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  private void injectSharedImage(String filePath) {
    String js = "window._sharedImagePath = '" + filePath + "'; " +
                "window.dispatchEvent(new CustomEvent('sharedImage', { detail: '" + filePath + "' })); " +
                "console.log('Shared image path injected: ' + '" + filePath + "');";
    
    getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
  }
}
