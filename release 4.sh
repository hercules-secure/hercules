#!/bin/bash

VERSION="$1"

if [ -z "$VERSION" ]; then
    echo "Ошибка: укажите версию"
    exit 1
fi

# 1. Собрали build
./build.sh "$VERSION" local

# 2. Переключились на релизную ветку
git checkout -b "release/${VERSION}" 2>/dev/null || git checkout "release/${VERSION}"

# 3. Скопировали build
cp -rf build/* . 2>/dev/null
# 3. Копируем build
cp -rf build/* .
cp -rf build/.[!.]* . 2>/dev/null
rm -rf build

# 4. Коммитим
git add .
git commit -m "Release ${VERSION}"


# 5. Пушим в основной
git push origin "release/${VERSION}" --force

# 6. Пушим в публичный
git push public "release/${VERSION}:main" --force

# 7. Возвращаемся
git checkout - 2>/dev/null

echo "Релиз ${VERSION} опубликован!"
