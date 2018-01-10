import { Observable } from 'rxjs/Observable'
import { MessageToUser } from './message'

const help = (userId, chatId) => Observable.of(new MessageToUser(userId, chatId,
        'Помощь\nЗдесь вы можете узнать актуальное расписание вылета самолетов'))

export default help
