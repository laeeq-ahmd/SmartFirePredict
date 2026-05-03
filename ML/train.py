from ultralytics import YOLO

# ─────────────────────────────────────────────────────────────────────────────
# SmartFirePredict — Continue YOLOv10s Training (Fine-tune from last.pt)
#
# NOTE: resume=True only works for INTERRUPTED runs.
#       Since epoch 10 finished cleanly, we start a new run using
#       last.pt as the pretrained weights (fine-tune continuation).
#
# Key fixes for smoke detection:
#   - cls=2.0: heavier penalty for missing smoke (fixes 2x class imbalance)
#   - copy_paste=0.4: copies smoke instances into more scenes
#   - mixup=0.2: blends smoke into diverse backgrounds
#   - hsv_s=0.8: wider saturation range for grey/white/black smoke
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':

    # Load last.pt as starting weights (NOT resume — fresh training run)
    model = YOLO(
        r"C:\Users\laeeq\Desktop\Projects\Major\Code\App\models\yolov10s_fire\weights\last.pt"
    )

    results = model.train(
        data    = r"C:\Users\laeeq\Desktop\Projects\Major\Code\ML\dataset.yaml",
        project = r"C:\Users\laeeq\Desktop\Projects\Major\Code\App\models",
        name    = "yolov10s_fire_v2",  # new folder so we keep the old best.pt safe
        exist_ok    = True,
        verbose     = True,

        # ── Budget ────────────────────────────────────────────────────────────
        epochs      = 20,
        fraction    = 0.5,
        save_period = 5,
        patience    = 8,

        # ── Hardware ──────────────────────────────────────────────────────────
        device  = 0,
        workers = 8,
        batch   = 8,
        imgsz   = 640,
        amp     = True,

        # ── Optimizer — lower LR since weights are already partially trained ──
        optimizer    = "AdamW",
        lr0          = 0.0005,   # half of original — fine-tuning stage
        lrf          = 0.01,
        momentum     = 0.937,
        weight_decay = 0.0005,
        warmup_epochs   = 1,
        warmup_momentum = 0.8,

        # ── Loss — KEY: doubled cls to fix smoke class imbalance ─────────────
        box = 7.5,
        cls = 2.0,   # was 1.0 — harder penalty forces model to learn smoke
        dfl = 1.5,

        # ── Augmentation ──────────────────────────────────────────────────────
        hsv_h = 0.02,
        hsv_s = 0.8,   # wider saturation → grey/white/black smoke coverage
        hsv_v = 0.7,   # wide brightness → dim lighter to overexposed flame
        degrees     = 10.0,
        translate   = 0.1,
        scale       = 0.6,
        flipud      = 0.1,
        fliplr      = 0.5,
        perspective = 0.001,
        mosaic      = 1.0,
        mixup       = 0.2,    # increased for smoke generalisation
        copy_paste  = 0.4,    # aggressively copies smoke into new scenes
        erasing     = 0.4,
    )

    print("\n" + "="*60)
    print("Fine-tune complete!")
    print(f"Best weights: {results.save_dir}\\weights\\best.pt")
    print("="*60)