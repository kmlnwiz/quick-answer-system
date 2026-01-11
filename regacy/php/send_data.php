<?php session_start();

date_default_timezone_set('Asia/Tokyo');
$microtime = microtime(true);  // 現在のUnixタイムスタンプ（マイクロ秒単位）
$time = date('Y-m-d H:i:s', (int)$microtime) . '.' . sprintf('%03d', ($microtime - (int)$microtime) * 1000);

require('../../dbconnect.php');

// フォームからのデータを受け取る
$setId = str_pad(mb_convert_kana(htmlspecialchars($_POST['SETID']), 'a'), 4, '0', STR_PAD_LEFT) ?? null;
$questionId = htmlspecialchars($_POST['QUESTIONID']) ?? null;
$username = htmlspecialchars($_POST['USERNAME']) ?? null;
$answer = htmlspecialchars($_POST['ANSWER']) ?? null;


// 基準時間を取得
$sql = "SELECT ANSWERTIME FROM SPEEDANSWER WHERE SETID = :setid AND QUESTIONID = :questionid AND ANSWER = 'SET_START' ORDER BY ANSWERID DESC LIMIT 1";
$stmt = $db->prepare($sql);
$stmt->execute([':setid' => $setId, ':questionid' => $questionId]);
$start_time = $stmt->fetchColumn();

if ($start_time) {
    // 基準時間($start_time)をタイムスタンプに変換
    $start_timestamp = strtotime($start_time); // 基準時間をUnixタイムスタンプに変換

    // 解答時間を計算（秒単位）
    $speed = $microtime - $start_timestamp;
    $speed = floor($speed * 1000) / 1000;

    $excution_time = 60 * 10; // 10分
    if ($speed >= $excution_time && $answer != 'SET_START') {
        http_response_code(400); // HTTPステータスコードを400（Bad Request）に設定
        echo "Error: Speed exceeds the limit."; // エラーメッセージを出力
        exit; // スクリプトを終了
    }


    // 時間、分、秒、小数点以下のミリ秒を計算
    $hours = floor($speed / 3600); // 時間
    $minutes = floor(($speed % 3600) / 60); // 分
    $seconds = floor($speed % 60); // 秒
    $milliseconds = sprintf('%03d', ($speed - floor($speed)) * 1000); // ミリ秒

    // 00:00:00.000 形式で整形
    $speed = sprintf('%02d:%02d:%02d.%03d', $hours, $minutes, $seconds, $milliseconds);
} else if($answer == 'SET_START'){
    $speed = 0;
}else{
    http_response_code(400); // HTTPステータスコードを400（Bad Request）に設定
    echo "Error: Speed exceeds the limit."; // エラーメッセージを出力
    exit; // スクリプトを終了
}

$locations = htmlspecialchars($_POST['LOCATIONS']) ?? null;
$username = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
$answer = htmlspecialchars($answer, ENT_QUOTES, 'UTF-8');
// IPアドレスを取得
$ip_address = $_SERVER['REMOTE_ADDR'];

$statement = $db->prepare('INSERT INTO SPEEDANSWER (SETID, QUESTIONID, LOCATIONS, USERNAME, ANSWER, ANSWERTIME, ANSWERSPEED, IP_ADDRESS) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
$statement->execute(array($setId, $questionId, $locations, $username, $answer, $time, $speed, $ip_address));

echo json_encode([$setId, $questionId, $locations, $username, $answer, $time, is_null($speed) ? 0 : (strtotime($speed) - strtotime('00:00:00') +(isset(explode('.', $speed)[1]) ? (explode('.', $speed)[1] / 1000) : 0)), $ip_address]);

exit;
?>
