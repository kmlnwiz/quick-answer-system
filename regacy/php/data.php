<?php session_start();
require('../../dbconnect.php');
require('../../islogin.php');

$sql = $db->query('SELECT * FROM SPEEDANSWER ORDER BY ANSWERTIME ASC, ANSWERID ASC');

while ($row = $sql->fetchObject()) {
    $data[] = array(
        'ANSWERID' => $row->ANSWERID,
        'SETID' => intval($row->SETID),
        'QUESTIONID' => $row->QUESTIONID,
        'LOCATIONS' => $row->LOCATIONS ?? '',
        'USERNAME' => $row->USERNAME ?? '',
        'ANSWER' => $row->ANSWER ?? '',
        'ANSWERTIME' => $row->ANSWERTIME,
        'ANSWERSPEED' => is_null($row->ANSWERSPEED) ? 0 : (strtotime($row->ANSWERSPEED) - strtotime('00:00:00') + (explode('.', $row->ANSWERSPEED)[1] / 1000)),
        'IP_ADDRESS' => $row->IP_ADDRESS ?? '',

    );
}

header('Content-Type: application/json');
echo json_encode($data);
?>
