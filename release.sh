#!/bin/bash

VERSION="$1"

# 1. Собрали build
./build.sh "$VERSION" local

# 2. Переключились на релизную ветку
git checkout -b "release/${VERSION}" 2>/dev/null || git checkout "release/${VERSION}"

# 3. Скопировали build поверх
cp -rf build/* .
cp -rf build/.[!.]* . 2>/dev/null

# 4. Закоммитили и запушили
git add .
git commit -m "Release ${VERSION}"
git push origin "release/${VERSION}" --force

# 5. Вернулись обратно
git checkout -