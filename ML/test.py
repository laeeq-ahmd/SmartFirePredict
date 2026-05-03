from ultralytics import YOLO

# Kaggle best.pt — larger pretrained model
model = YOLO(r"C:\Users\laeeq\Desktop\Projects\Major\Code\App\models\kaggle\best (1).pt")

# Iterate over the stream to show the webcam window
for result in model.predict(
    source=0,
    conf=0.35,   # balanced: catches fire/smoke, reduces garment false positives
    iou=0.45,
    show=True,
    save=False,
    stream=True,
    verbose=False,
):
    pass  # window is handled by show=True