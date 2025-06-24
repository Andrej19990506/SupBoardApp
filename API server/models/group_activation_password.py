from sqlalchemy import Column, Integer, String, DateTime, func
from .base import Base

class GroupActivationPassword(Base):
    __tablename__ = 'group_activation_passwords'
 
    id = Column(Integer, primary_key=True, autoincrement=True)
    password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 