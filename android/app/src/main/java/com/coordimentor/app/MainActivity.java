package com.coordimentor.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

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

      @JavascriptInterface
      public void openGallery() {
        runOnUiThread(() -> {
          // 갤러리 앱 메인 화면 직접 실행 (패키지 런처 방식)
          String[] galleryPackages = {
            "com.sec.android.gallery3d",      // 삼성 갤러리
            "com.google.android.apps.photos", // 구글 포토
            "com.miui.gallery",               // 샤오미
            "com.asus.gallery",               // ASUS
          };
          Intent intent = null;
          for (String pkg : galleryPackages) {
            Intent candidate = getPackageManager().getLaunchIntentForPackage(pkg);
            if (candidate != null) {
              intent = candidate;
              break;
            }
          }
          // 위 패키지가 없으면 이미지 뷰어로 폴백
          if (intent == null) {
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setType("image/*");
          }
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          startActivity(intent);
        });
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
    setIntent(intent); // 중요: 인텐트 갱신
    handleIntent(intent);
  }

  private void handleIntent(Intent intent) {
    String action = intent.getAction();
    String type = intent.getType();

    if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("image/")) {
      // EXTRA_STREAM 우선 시도
      Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);

      // Samsung 등 일부 기기: ClipData에 URI가 있는 경우 폴백
      if (imageUri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
        imageUri = intent.getClipData().getItemAt(0).getUri();
        android.util.Log.d("Coordimentor", "URI from ClipData: " + imageUri);
      }

      if (imageUri != null) {
        android.util.Log.d("Coordimentor", "Processing shared image: " + imageUri);
        processSharedImage(imageUri);
      } else {
        android.util.Log.w("Coordimentor", "No image URI found in intent");
      }
    }
  }

  private void processSharedImage(Uri uri) {
    try {
      InputStream inputStream = getContentResolver().openInputStream(uri);
      if (inputStream == null) {
        android.util.Log.e("Coordimentor", "Cannot open InputStream for: " + uri);
        return;
      }
      java.io.File cacheDir = getCacheDir();
      java.io.File tempFile = new java.io.File(cacheDir, "shared_image.png"); // PNG 확장자 (누끼는 PNG)
      java.io.FileOutputStream outputStream = new java.io.FileOutputStream(tempFile);

      byte[] buffer = new byte[8192];
      int len;
      while ((len = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, len);
      }
      outputStream.close();
      inputStream.close();

      lastSharedImagePath = tempFile.getAbsolutePath();
      android.util.Log.d("Coordimentor", "Shared image saved: " + lastSharedImagePath);
      injectSharedImage(lastSharedImagePath);
    } catch (Exception e) {
      android.util.Log.e("Coordimentor", "processSharedImage failed", e);
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
