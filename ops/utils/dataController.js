exports.getCurrentDateTimeString = async () => {
    return new Date().toISOString().
        replaceAll(',', '').replaceAll('/', '').replaceAll(':', '').replaceAll(' ', '').slice(0,-5);
}