def add_crud(file_path, model_name, router_name):
    code = f"""
@router.put("/{{id}}")
def update_{model_name.lower()}(id: int, item: dict, db: Session = Depends(get_db)):
    db_item = db.query({model_name}).filter({model_name}.id == id).first()
    if not db_item:
        return {{"error": "not found"}}
    for k, v in item.items():
        setattr(db_item, k, v)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{{id}}")
def delete_{model_name.lower()}(id: int, db: Session = Depends(get_db)):
    db_item = db.query({model_name}).filter({model_name}.id == id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {{"status": "deleted"}}
"""
    with open(file_path, "a") as f:
        f.write(code)

add_crud("backend/app/api/esg.py", "ESGMetric", "router")
add_crud("backend/app/api/operational.py", "CyberIncident", "router")
add_crud("backend/app/api/vendor.py", "Vendor", "router")
add_crud("backend/app/api/mrm.py", "ModelRegistry", "router")
