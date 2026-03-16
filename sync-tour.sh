#!/bin/sh
# Sync tour assets from repo root into frontend/public/ for the tour page.
# Run after updating TOUR.md or screenshots/.
cp TOUR.md frontend/public/TOUR.md
cp screenshots/*.png frontend/public/screenshots/
echo "Tour assets synced to frontend/public/"
