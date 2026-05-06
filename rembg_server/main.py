from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove
import io

app = FastAPI(title="Rembg Server")

# 앱 어디서나 API를 호출할 수 있도록 CORS 설정 허용 (보안 필요 시 도메인 제한 가능)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Rembg Background Removal API is running!"}

@app.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    # 업로드된 파일 읽기
    contents = await file.read()
    
    # rembg를 사용하여 배경 제거 (u2net 모델이 기본으로 다운로드됨)
    # 메모리를 절약하기 위해 alpha matting 등의 추가 옵션은 껐습니다.
    output_image = remove(contents)
    
    # 결과를 PNG 포맷의 이미지로 직접 반환
    return Response(content=output_image, media_type="image/png")
