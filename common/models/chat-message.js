module.exports = function(ChatMessage) {

  ChatMessage.allStatus = {
    normal: 1,
    receiverDeleted: 3,
    senderDeleted: 4,
    bothDeleted: 5
  }
};
