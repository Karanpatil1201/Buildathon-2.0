from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, User
from app.schemas import ProductCreate, ProductUpdate, ProductOut
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=List[ProductOut])
def list_products(include_archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(Product)
    if not include_archived:
        query = query.filter(Product.is_archived == False)
    return query.order_by(Product.name).all()

@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["quality_manager", "admin", "supervisor"]))
):
    existing = db.query(Product).filter(Product.code == product_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with code '{product_in.code}' already exists")
    
    product = Product(
        code=product_in.code.upper(),
        name=product_in.name,
        category=product_in.category,
        description=product_in.description,
        is_archived=False
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["quality_manager", "admin"]))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    return product
