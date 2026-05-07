package com.coordimentor.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
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
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FirebaseAuthenticationPlugin.class);
    super.onCreate(savedInstanceState);

    // SharedArrayBuffer 활성화 (AI 배경 제거에 필요)
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
      ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream();
      int bufferSize = 1024;
      byte[] buffer = new byte[bufferSize];

      int len = 0;
      while ((len = inputStream.read(buffer)) != -1) {
        byteBuffer.write(buffer, 0, len);
      }
      String base64Image = Base64.encodeToString(byteBuffer.toByteArray(), Base64.DEFAULT);
      String fullDataUrl = "data:image/jpeg;base64," + base64Image.replace("\n", "").replace("\r", "");
      
      // 웹뷰로 데이터 전달 및 업로드 탭으로 이동 트리거
      // 1. 전역 변수에 저장 (데이터 유실 방지)
      // 2. 이벤트를 발생시켜 현재 켜져있는 리액트 앱이 반응하게 함
      String js = "window._sharedImage = '" + fullDataUrl + "'; " +
                  "window.dispatchEvent(new CustomEvent('sharedImage', { detail: '" + fullDataUrl + "' })); " +
                  "console.log('Shared image injected to window');";
      
      getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}
