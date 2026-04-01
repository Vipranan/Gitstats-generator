from sqlalchemy import Column, Integer, String, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class FileChange(Base):
    __tablename__ = "file_changes"

    id = Column(Integer, primary_key=True, index=True)
    commit_id = Column(Integer, ForeignKey("commits.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    language = Column(String, nullable=True, index=True)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)

    commit = relationship("Commit", back_populates="file_changes")

    __table_args__ = (
        Index("ix_file_changes_commit_lang", "commit_id", "language"),
    )
