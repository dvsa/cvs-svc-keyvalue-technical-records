class TechRecordsDAOMock {
  constructor () {
    this.techRecordsMock = null
    this.numberOfrecords = null
    this.numberOfScannedRecords = null
    this.isDatabaseOn = true
  }

  getAll () {
    const responseObject = {
      Items: this.techRecordsMock,
      Count: this.numberOfrecords,
      ScannedCount: this.numberOfScannedRecords
    }

    if (!this.isDatabaseOn) { return Promise.reject(responseObject) }

    return Promise.resolve(responseObject)
  }

  getBySearchTerm (searchTerm) {
    const responseObject = {
      Items: this.techRecordsMock,
      Count: this.numberOfrecords,
      ScannedCount: this.numberOfScannedRecords
    }

    if (!this.isDatabaseOn) { return Promise.reject(responseObject) }

    return Promise.resolve(responseObject)
  }
}

module.exports = TechRecordsDAOMock