from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Commit(Base):
    __tablename__ = "commits"

    id = Column(Integer, primary_key=True, index=True)
    sha = Column(String, unique=True, nullable=False, index=True)
    repo_id = Column(Integer, ForeignKey("repos.id"), nullable=False, index=True)
    contributor_id = Column(Integer, ForeignKey("contributors.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    week = Column(String, nullable=False, index=True)  # e.g. "2026-W10"
    message = Column(String, nullable=True)

    repo = relationship("Repo", back_populates="commits")
    contributor = relationship("Contributor", back_populates="commits")
    file_changes = relationship("FileChange", back_populates="commit", cascade="all, delete-orphan")
