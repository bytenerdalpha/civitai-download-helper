from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import uvicorn
import aiohttp
import tqdm
import os


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
TOKEN = os.getenv("TOKEN")
LORA_DOWNLOAD_DIR = os.getenv("LORA_DOWNLOAD_DIR")
MODEL_DOWNLOAD_DIR = os.getenv("MODEL_DOWNLOAD_DIR")
EMBEDDING_DOWNLOAD_DIR = os.getenv("EMBEDDING_DOWNLOAD_DIR")
resourceType_dir_mapping = {
    "lora": LORA_DOWNLOAD_DIR,
    "model": MODEL_DOWNLOAD_DIR,
    "checkpoint": MODEL_DOWNLOAD_DIR,
    "embedding": EMBEDDING_DOWNLOAD_DIR
}

class Item(BaseModel):
    url: str
    name: str
    resourceType: str
    modelVersionId: str
    resourceNameNormalized: str

def file_exists(directory, filename):
    file_path = os.path.join(directory, filename)
    return os.path.isfile(file_path)


@app.post("/civitai/v1/resource/")
async def create_item(item: Item):
    try:
        directory = resourceType_dir_mapping.get(item.resourceType.lower(), "/tmp/")
        if file_exists(directory, item.resourceNameNormalized):
            print("File exists.")
            return {"message": "File already exists."}
        else:
            print("File does not exist.")
            downloadUrl = f"https://civitai.com/api/download/models/{item.modelVersionId}"
            headers = {"Authorization": f"Bearer {TOKEN}"}

            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(downloadUrl) as response:
                    response.raise_for_status()
                    total = int(response.headers.get('content-length', 0))
                    tqdm_params = {
                        'desc': downloadUrl,
                        'total': total,
                        'miniters': 1,
                        'unit': 'B',
                        'unit_scale': True,
                        'unit_divisor': 1024,
                    }
                    with tqdm.tqdm(**tqdm_params) as pb:
                        with open(os.path.join(directory, item.resourceNameNormalized), 'wb') as file:
                            chunk_size = 8192
                            async for data in response.content.iter_chunked(chunk_size):
                                file.write(data)
                                pb.update(chunk_size)

            return {"message": "File has been downloaded successfully."}
    except aiohttp.ClientError as err:
        print(err)
        raise HTTPException(status_code=400, detail="URL request error: {}".format(err))
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Unexpected error: {}".format(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)