from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove, new_session
import io
import logging
import time

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Coordimentor Rembg Server")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 세션 미리 생성 (첫 요청 시 모델 다운로드/로드 지연 방지)
# 기본 모델: u2net
session = new_session("u2net")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Coordimentor Rembg API is running!",
        "model": "u2net"
    }

@app.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    start_time = time.time()
    logger.info(f"Received background removal request: {file.filename}")
    
    try:
        # 파일 타입 검증
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Uploaded file is not an image.")
            
        contents = await file.read()
        
        # rembg를 사용하여 배경 제거
        # session을 재사용하여 속도 향상
        output_image = remove(contents, session=session)
        
        duration = time.time() - start_time
        logger.info(f"Successfully processed image in {duration:.2f} seconds")
        
        return Response(content=output_image, media_type="image/png")
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to process image", "details": str(e)}
        )
