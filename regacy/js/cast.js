let maxPoint = 70;
let minPoint = 0;
let step = 10;

function outputTable(array) {
    let html = '';
    array.forEach((element, index) => {

        let bgColor = '',
            textColor = '';

        const gapTime = element.ANSWERSPEED - array[index - 1]?.ANSWERSPEED;

        if (index == 0) {
            bgColor = 'bg-danger-subtle';
            textColor = 'text-danger-emphasis';
        } else if (index < 3) {
            bgColor = 'bg-warning-subtle';
            textColor = 'text-warning-emphasis';
        };
        html += `<tr class="border-subtle-light border-2">`;
        html += `<th class="text-center align-content-center ${bgColor + ' ' + textColor}">${getOrdinalSuffix(index + 1)}</th>`;
        html += `<th class="text-center align-content-center ${bgColor + ' ' + textColor}">${Math.max(maxPoint - (index * step), minPoint)} Pts</th>`;
        html += `<td class="text-center align-content-center ${bgColor + ' ' + textColor}">${Number(element.QUESTIONID) == 0 ? 'テスト' : Number(element.QUESTIONID) + '問目'}</td>`;
        html += `<td class="text-center align-content-center ${bgColor + ' ' + textColor}">${escapeHTML(element.LOCATIONS)}</td>`;
        html += `<td class="text-center align-content-center ${bgColor + ' ' + textColor}">${escapeHTML(element.USERNAME)}</td>`;
        //html += `<td class="text-center align-content-center ${bgColor + ' ' + textColor}">${escapeHTML(element.ANSWER)}</td>`;
        html += `<td class="text-end align-content-center ${bgColor + ' ' + textColor}">${element.ANSWERSPEED.toFixed(3)} 秒</td>`;
        html += `</tr>`;
    });

    $(`#data`).html(html);
};

/* ---------- */

const channel = new BroadcastChannel('shared-channel');

$(function () {
    // データの状態を管理
    sharedData = [];

    // 受信メッセージを処理
    channel.onmessage = (event) => {
        const { type, payload } = event.data;

        switch (type) {
            case 'add': // データ追加
                sharedData.push(payload);
                console.log('Data added:', payload);
                outputTable(sharedData);
                break;

            case 'deleteAll': // 全データ削除
                sharedData = [];
                console.log('All data deleted');
                outputTable(sharedData);
                break;

            case 'deleteOne': // 特定データ削除
                sharedData = sharedData.filter((item) => item.ANSWERID !== payload.ANSWERID);
                console.log('Data deleted:', payload);
                console.log('Remaining data:', sharedData);
                outputTable(sharedData);
                break;

            case 'point': // ポイント表示
                console.log('Point:', payload);
                maxPoint = payload[0];
                minPoint = payload[1];
                step = payload[2];
                break;

            default:
                console.log('Unknown action:', type);
        }
    };
});

function deleteAllData() {
    channel.postMessage({ type: 'deleteAll' });
};

function deleteOneData(index) {
    channel.postMessage({ type: 'deleteOne', payload: data });
};


document.addEventListener(
    "keydown",
    (e) => {
        if (e.keyCode === 13) {
            toggleFullScreen();
        };
    },
    false
);

function toggleFullScreen() {
    const elem = document.getElementById("Content");

    if (!document.fullscreenElement) {
        elem.requestFullscreen().then(() => {
            document.documentElement.style.overflow = 'auto';
            document.body.style.overflow = 'auto';
            elem.style.overflow = 'auto';
            elem.style.height = '100vh';
        }).catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            elem.style.overflow = '';
            elem.style.height = '';
        }).catch(err => {
            console.error(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
        });
    };
};

function getOrdinalSuffix(number) {
    const suffixes = ["th", "st", "nd", "rd"];
    const remainder10 = number % 10;
    const remainder100 = number % 100;

    if (remainder100 >= 11 && remainder100 <= 13) {
        return number + "th";
    } else if (remainder10 >= 1 && remainder10 <= 3) {
        return number + suffixes[remainder10];
    } else {
        return number + "th";
    };
};
