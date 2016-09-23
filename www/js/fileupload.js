function UploadInput(filename, fileBase64) {
    this.filename = filename;
    this.fileBase64 = fileBase64;
}

_files = [];
_maxUploadSize = Number.MAX_VALUE;
_currentUploadSize = 0;
_estimatedMetadataSize = 0;

function updateCurrentUploadSize() {
    if (_files.length > 0) {
        _currentUploadSize = JSON.stringify(_files).length;
    } else {
        _currentUploadSize = 0;
    }
    $("#upload-size-label").text("(" + formatBytes(_currentUploadSize, 0) + " of " + formatBytes(_maxUploadSize, 0) + " used)");
}

$(document).ready(function () {
    // set the max upload size, if one is given
    var mus = $("#max-upload-size").val();
    if ($.isNumeric(mus)) {
        _maxUploadSize = mus;
    }
    updateCurrentUploadSize();

    // estimate the metadata size
    // get the row template
    var rowTemplate = $(".upload-row-template");
    // get the custom metadata inputs
    var inputs = $(rowTemplate).find(".file-metadata");
    for (i = 0; i < inputs.length; i++) {
        // the id is the name and 32 is for the value
        _estimatedMetadataSize += (inputs[i].id.length + 32);
    }

    $(".datepicker").datepicker();

    $(".set-all").on(
        'click',
        function (e) {
            var fileMetadataName = this.dataset.fileMetadataName;

            // get the template input and its value
            var template = $.find("[data-file-metadata-name='" + fileMetadataName + "Template']");
            var templateValue = $(template).val();

            // get the file-metadata inputs
            var inputs = $.find(".file-metadata[data-file-metadata-name='" + fileMetadataName + "']");

            // set the value and trigger the change event
            $(inputs).val(templateValue);

            // .val(value) doesn't trigger onchange, 
            //      which is good because we don't want to call updateCurrentUploadSize() for every change, 
            //      just once after all the changes
            //
            // We do need to set the value for each of the UploadInputs though.
            for (i = 0; i < _files.length; i++) {
                _files[i][fileMetadataName] = templateValue;
            }
            updateCurrentUploadSize();
        }
    )

    $(".upload-container").on(
        'dragover',
        function (e) {
            e.preventDefault();
            e.stopPropagation();
        }
    )
    $(".upload-container").on(
        'dragenter',
        function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).addClass("upload-container-hover");
        }
    )
    $(".upload-container").on(
        'drop',
        function (e) {
            if (e.originalEvent.dataTransfer) {
                if (e.originalEvent.dataTransfer.files.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    // processFiles expects an array
                    processFiles(jQuery.makeArray(e.originalEvent.dataTransfer.files));
                }
            }
            $(this).removeClass("upload-container-hover");
        }
    )
    $(".upload-container").on(
        'dragleave',
        function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass("upload-container-hover");
        }
    )
    $(".upload-submit-button").on(
        'click',
        function (e) {
            uploadFiles();
        }
    )
})

function processFile(file) {
    return new Promise(function (resolve, reject) {
        var fileBase64Length = 4 * Math.ceil(file.size / 3);
        if (_currentUploadSize + fileBase64Length + _estimatedMetadataSize <= _maxUploadSize) {
            var reader = new FileReader();
            reader.readAsArrayBuffer(file);
            var filename = file.name;

            reader.onload = function () {
                var uploadInput = new UploadInput(filename, arrayBufferToBase64(reader.result));
                _files.push(uploadInput);
                createInputRow(uploadInput);
                updateCurrentUploadSize();
                resolve();
            }
            reader.onerror = function () {
                alert("failed reading file");
            }
        } else {
            reject();
        }
    })
}

/*
 * files needs to be an array so we can shift and recursively process the array
 */
function processFiles(files) {
    // remove the first file from the array 
    var file = files.shift();
    if (file) {
        processFile(file)
        // recurse after the file is processed
        .then(function (a) {
            processFiles(files);
        })
        // even if the file failed to process, we want to try processing the other files
        .catch(function (a) {
            processFiles(files);
        });
    }
}

function createInputRow(uploadInput) {
    // get the input div
    var inputContainer = $("#upload-inputs");

    // get the row template
    var rowTemplate = $(".upload-row-template");

    // clone the template
    var newRow = rowTemplate
        .clone()
        .removeClass("hidden")
        .removeClass("upload-row-template")
        .addClass("upload-row");

    // give the newRow a unique id
    newRow[0].id = guid();

    // add the row id to uploadInput
    uploadInput["rowId"] = newRow[0].id;

    // get the custom metadata inputs
    var inputs = $(newRow).find(".file-metadata");

    for (i = 0; i < inputs.length; i++) {
        // get the input
        var input = inputs[i];

        // change the id to something unique
        input.id = guid();

        // set the value in case there are defaults and onchange is never triggered
        uploadInput[input.dataset.fileMetadataName]= $(input).val();

        // when the input changes, update the value in uploadInput
        input.onchange = function () {
            uploadInput[this.dataset.fileMetadataName] = this.value;
            updateCurrentUploadSize();
        }

        // check if it's a datepicker
        if ($(input).hasClass("datepicker")) {
            // the datepicker won't work if the hasDatepicker class is there
            $(input).removeClass("hasDatepicker");
            $(input).datepicker();
            $(input).datepicker("setDate", new Date());

            // set the default date in uploadInput
            uploadInput[input.dataset.fileMetadataName] = new Date();
        }
    }

    // set the filename
    var filenameElement = newRow.find(".filename");
    $(filenameElement).each(function () {
        if ($(this).is("input[type=text]")) {
            var filenameNoExt = uploadInput.filename.substring(0, uploadInput.filename.lastIndexOf('.'));
            this.value = filenameNoExt;
            uploadInput[this.dataset.fileMetadataName] = filenameNoExt;
        } else {
            $(this).html(uploadInput.filename);
        }
    });

    // get the cancel button
    var cancelButton = $(newRow).find(".cancel-upload")[0];

    // add the onclick function
    cancelButton.onclick = function () {
        // remove the row
        $(newRow).remove();

        // remove the UploadInput from the array
        var indexToRemove = _files.indexOf(uploadInput);
        if (indexToRemove > -1) {
            _files.splice(indexToRemove, 1);
            updateCurrentUploadSize();
        }
    }

    // append the row
    newRow.appendTo(inputContainer);
}

function uploadFiles() {
    $.blockUI({ message: null });

    // clear any existing results
    $("#upload-results-div").html("");

    var requests = [];

    $.each(_files, function (key, file) {

        var formData = {
            "files": [file]
        }

        var json = JSON.stringify(formData);

        requests.push($.ajax({
            url: 'Images.aspx/UploadFiles',
            type: 'POST',
            data: json,
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            success: function (result) {
                // remove the upload rows
                removeSuccessfulUploads(result.d);

                // display the result
                displayUploadResults(result.d);
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                // display the error
                $("#upload-results-div").html("Request: " + XMLHttpRequest.toString() + "\n\nStatus: " + textStatus + "\n\nError: " + errorThrown);

                // for some reason, if an error occurs the UI never unblocks
                // so unblock it manually
                $.unblockUI();
            }
        }));
    })

    $.when.apply($, requests).then(function () {
        $.unblockUI();
    })
}

function removeSuccessfulUploads(results) {
    var jsonArray = jQuery.parseJSON(results);
    if (jsonArray.successfulUploads) {
        $.each(jsonArray.successfulUploads, function (key, value) {
            _files = $.grep(_files, function (f) {
                return f.rowId !== value.rowId;
            });
            $("#" + value.rowId).remove();
        });
        updateCurrentUploadSize();
    }
}

function displayUploadResults(results) {
    var jsonArray = jQuery.parseJSON(results);
    if (jsonArray.errors) {
        $.each(jsonArray.errors, function (key, value) {
            var errorMessage = "<p><b>Error uploading " + value.filename + "</b><br />" + value.errorMessage + "</p>";
            $("#upload-results-div").append(errorMessage);
        });
    }
}

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
}

function formatBytes(bytes, decimals) {
    if (bytes == 0) return '0 Bytes';
    var interval = 1000; // or 1024 for binary
    var decimalDigits = $.isNumeric(decimals) && decimals >= 0 && decimals <=20 ? decimals : 2;
    var units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var unit = Math.floor(Math.log(bytes) / Math.log(interval));
    return parseFloat((bytes / Math.pow(interval, unit)).toFixed(decimalDigits)) + ' ' + units[unit];
}