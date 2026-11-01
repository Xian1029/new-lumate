import uuid
from pydantic import BaseModel, Field
class PdfAnchor(BaseModel):
    page: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=2400)
class PdfExplanationRequest(BaseModel):
    course_id: uuid.UUID
    job_id: uuid.UUID
    anchor: PdfAnchor
    question: str = Field(default="请用适合学生的方式解释这段内容。", min_length=1, max_length=800)
